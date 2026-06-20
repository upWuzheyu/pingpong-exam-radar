const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const exampleFeedPath = path.join(rootDir, 'data', 'exam-feed.example.json');
const sourcesPath = path.join(rootDir, 'data', 'feed-sources.json');
const generatedFeedPath = path.join(rootDir, 'data', 'exam-feed.generated.json');

const candidateSignals = ['乒乓球', '裁判员', '教练员', '培训', '培训班', '晋升', '报名', '通知'];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function fetchText(url) {
  const client = url.startsWith('https://') ? https : http;

  return new Promise((resolve, reject) => {
    const request = client.get(
      url,
      {
        headers: {
          'accept': 'text/html,application/xhtml+xml',
          'accept-encoding': 'identity',
          'user-agent': 'calendar-app-exam-feed-updater/1.0',
        },
        timeout: 15000,
      },
      (response) => {
        if (
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          response.resume();
          resolve(fetchText(new URL(response.headers.location, url).toString()));
          return;
        }

        if (response.statusCode < 200 || response.statusCode >= 300) {
          response.resume();
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      }
    );

    request.on('timeout', () => {
      request.destroy(new Error('Request timed out'));
    });
    request.on('error', reject);
  });
}

function extractLinks(html, baseUrl) {
  const links = [];
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorPattern.exec(html)) !== null) {
    const href = decodeHtml(stripTags(match[1])).trim();
    const title = decodeHtml(stripTags(match[2])).replace(/\s+/g, ' ').trim();

    if (!href || !title || href.startsWith('javascript:') || href.startsWith('#')) {
      continue;
    }

    try {
      links.push({
        title,
        url: new URL(href, baseUrl).toString(),
      });
    } catch {
      // Ignore malformed links from source pages.
    }
  }

  return links;
}

function stripTags(value) {
  return value.replace(/<[^>]*>/g, '');
}

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function isCandidateTitle(title, keywords) {
  const matchedKeywords = keywords.filter((keyword) => title.includes(keyword));
  const matchedSignals = candidateSignals.filter((keyword) => title.includes(keyword));

  return matchedKeywords.length > 0 && matchedSignals.length >= 2;
}

function toExamItem(link, source, checkedAt) {
  return {
    id: `auto-${hash(`${source.name}:${link.url}:${link.title}`)}`,
    title: link.title,
    certificateType: inferCertificateType(link.title),
    province: inferProvince(source),
    city: inferCity(source),
    organization: source.name,
    registrationStartDate: '',
    registrationEndDate: '',
    examDate: '',
    location: '',
    sourceUrl: link.url,
    status: '待核验',
    isMock: false,
    verified: false,
    dataSourceType: 'official',
    lastCheckedAt: checkedAt,
    note: '自动抓取，部分字段待人工核验。请以官方体育局、乒协、学校或培训机构通知为准。',
  };
}

function inferCertificateType(title) {
  if (title.includes('裁判')) {
    return title.includes('乒乓球') ? '乒乓球二级裁判员证' : '二级裁判员证';
  }

  return '初级教练员证';
}

function inferProvince(source) {
  if (source.name.includes('广东')) return '广东';
  if (source.name.includes('山西')) return '山西';
  if (source.name.includes('江西')) return '江西';
  if (source.name.includes('常州')) return '江苏';
  return '全国';
}

function inferCity(source) {
  if (source.name.includes('常州')) return '常州';
  return '';
}

function hash(value) {
  return crypto.createHash('sha1').update(value).digest('hex').slice(0, 12);
}

function dedupeItems(items) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const key = item.sourceUrl || `${item.organization}:${item.title}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(item);
  }

  return result;
}

async function collectCandidates(sources) {
  const checkedAt = new Date().toISOString();
  const candidates = [];

  for (const source of sources) {
    try {
      console.log(`Fetching ${source.name}: ${source.url}`);
      const html = await fetchText(source.url);
      const links = extractLinks(html, source.url).filter((link) =>
        isCandidateTitle(link.title, source.keywords)
      );

      console.log(`Found ${links.length} candidate links from ${source.name}`);
      candidates.push(...links.map((link) => toExamItem(link, source, checkedAt)));
    } catch (error) {
      console.warn(`Failed to fetch ${source.name}: ${error.message}`);
    }
  }

  return candidates;
}

async function main() {
  const seedItems = readJson(exampleFeedPath);
  const sources = readJson(sourcesPath);
  const candidates = await collectCandidates(sources);
  const generatedItems = dedupeItems([...seedItems, ...candidates]);

  writeJson(generatedFeedPath, generatedItems);
  console.log(`Wrote ${generatedItems.length} items to ${generatedFeedPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
