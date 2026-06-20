const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const exampleFeedPath = path.join(rootDir, 'data', 'exam-feed.example.json');
const sourcesPath = path.join(rootDir, 'data', 'feed-sources.json');
const generatedFeedPath = path.join(rootDir, 'data', 'exam-feed.generated.json');
const debugReportPath = path.join(rootDir, 'data', 'feed-debug-report.json');

const tableTennisKeyword = '乒乓球';
const roleKeywords = ['裁判员', '教练员'];
const actionKeywords = ['报名', '培训', '考试', '晋升', '认证', '资格'];
const debugKeywords = [
  tableTennisKeyword,
  ...roleKeywords,
  ...actionKeywords,
  '一级',
  '二级',
  '三级',
  '初级',
  '中级',
  '高级',
];

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
          accept: 'text/html,application/xhtml+xml',
          'accept-encoding': 'identity',
          'user-agent': 'calendar-app-exam-feed-updater/1.0',
        },
        timeout: 15000,
      },
      (response) => {
        const statusCode = response.statusCode || 0;

        if (statusCode >= 300 && statusCode < 400 && response.headers.location) {
          response.resume();
          resolve(fetchText(new URL(response.headers.location, url).toString()));
          return;
        }

        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          const html = Buffer.concat(chunks).toString('utf8');

          if (statusCode < 200 || statusCode >= 300) {
            reject(Object.assign(new Error(`HTTP ${statusCode}`), { statusCode, html }));
            return;
          }

          resolve({ html, statusCode });
        });
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
  const seen = new Set();
  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorPattern.exec(html)) !== null) {
    const attributes = match[1] || '';
    const body = match[2] || '';
    const href = decodeHtml(getAttribute(attributes, 'href') || '').trim();

    if (!href || href.startsWith('javascript:') || href.startsWith('#')) {
      continue;
    }

    let url;
    try {
      url = new URL(href, baseUrl).toString();
    } catch {
      continue;
    }

    const titleAttribute = decodeHtml(getAttribute(attributes, 'title') || '').trim();
    const text = normalizeText(decodeHtml(stripTags(body)));
    const title = text || normalizeText(titleAttribute) || href;
    const dedupeKey = `${url}::${title}`;

    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    links.push({ title, url, text, href });
  }

  return links;
}

function getAttribute(attributes, name) {
  const pattern = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, 'i');
  const match = attributes.match(pattern);
  return match?.[1] || '';
}

function stripTags(value) {
  return value.replace(/<[^>]*>/g, '');
}

function normalizeText(value) {
  return value.replace(/\s+/g, ' ').trim();
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

function getMatchedKeywords(link, sourceKeywords) {
  const searchTarget = `${link.title} ${link.text || ''} ${link.url}`;
  const keywords = Array.from(new Set([...debugKeywords, ...(sourceKeywords || [])]));
  return keywords.filter((keyword) => searchTarget.includes(keyword));
}

function getCandidateMatch(link, sourceKeywords) {
  const searchTarget = `${link.title} ${link.text || ''} ${link.url}`;
  const matchedKeywords = getMatchedKeywords(link, sourceKeywords);
  const hasTableTennis = searchTarget.includes(tableTennisKeyword);
  const matchedRole = roleKeywords.find((keyword) => searchTarget.includes(keyword)) || '';
  const matchedAction = actionKeywords.find((keyword) => searchTarget.includes(keyword)) || '';

  if (!hasTableTennis || !matchedRole || !matchedAction) {
    return {
      ok: false,
      matchedKeywords,
      matchReason: [
        hasTableTennis ? '包含乒乓球' : '缺少乒乓球',
        matchedRole ? `包含${matchedRole}` : '缺少裁判员/教练员',
        matchedAction ? `包含${matchedAction}` : '缺少报名/培训/考试/晋升/认证/资格',
      ].join('；'),
    };
  }

  return {
    ok: true,
    matchedKeywords,
    matchReason: `包含乒乓球；包含${matchedRole}；包含${matchedAction}`,
  };
}

function toExamItem(link, source, checkedAt) {
  const category = inferCategory(link.title);
  const level = inferLevel(link.title, category);

  return {
    id: `auto-${hash(`${source.name}:${link.url}:${link.title}`)}`,
    title: link.title,
    certificateType: inferCertificateType(category, level),
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
    note: '自动抓取候选结果，需人工核验报名时间、地点和资格要求',
    category,
    level,
    matchReason: link.matchReason,
  };
}

function inferCategory(title) {
  return title.includes('裁判员') ? '裁判员' : '教练员';
}

function inferLevel(title, category) {
  if (category === '裁判员') {
    if (title.includes('一级裁判员') || title.includes('一级')) return '一级裁判员';
    if (title.includes('二级裁判员') || title.includes('二级')) return '二级裁判员';
    if (title.includes('三级裁判员') || title.includes('三级')) return '三级裁判员';
    return '裁判员（未分级）';
  }

  if (title.includes('初级教练员') || title.includes('初级')) return '初级教练员';
  if (title.includes('中级教练员') || title.includes('中级')) return '中级教练员';
  if (title.includes('高级教练员') || title.includes('高级')) return '高级教练员';
  return '教练员（未分级）';
}

function inferCertificateType(category, level) {
  if (category === '裁判员') {
    if (level === '二级裁判员') return '乒乓球二级裁判员证';
    return '二级裁判员证';
  }

  if (level === '初级教练员') return '初级教练员证';
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

async function inspectSource(source) {
  const checkedAt = new Date().toISOString();
  const report = {
    sourceName: source.name,
    sourceUrl: source.url,
    ok: false,
    statusCode: null,
    htmlLength: 0,
    totalLinksFound: 0,
    matchedLinksCount: 0,
    matchedLinks: [],
    errorMessage: '',
    checkedAt,
  };

  console.log(`\n=== Checking source: ${source.name} ===`);
  console.log(`URL: ${source.url}`);

  try {
    const { html, statusCode } = await fetchText(source.url);
    report.ok = true;
    report.statusCode = statusCode;
    report.htmlLength = html.length;

    console.log(`HTTP success: yes`);
    console.log(`HTTP status: ${statusCode}`);
    console.log(`HTML length: ${html.length}`);

    const links = extractLinks(html, source.url);
    report.totalLinksFound = links.length;
    console.log(`Total links extracted: ${links.length}`);

    const matchedLinks = links
      .map((link) => {
        const match = getCandidateMatch(link, source.keywords);
        return {
          ...link,
          matchedKeywords: match.matchedKeywords,
          matchReason: match.matchReason,
          isCandidate: match.ok,
        };
      })
      .filter((link) => link.isCandidate);

    report.matchedLinks = matchedLinks.map((link) => ({
      title: link.title,
      url: link.url,
      matchedKeywords: link.matchedKeywords,
      matchReason: link.matchReason,
    }));
    report.matchedLinksCount = report.matchedLinks.length;

    console.log(`Matched candidate links: ${report.matchedLinksCount}`);
    if (report.matchedLinksCount === 0) {
      console.log(`No candidates: no extracted link title/text/URL contained configured keywords.`);
    } else {
      for (const link of report.matchedLinks) {
        console.log(`- ${link.title}`);
        console.log(`  ${link.url}`);
        console.log(`  matched: ${link.matchedKeywords.join(', ')}`);
        console.log(`  reason: ${link.matchReason}`);
      }
    }

    return {
      report,
      candidates: matchedLinks.map((link) => toExamItem(link, source, checkedAt)),
    };
  } catch (error) {
    report.statusCode = error.statusCode || null;
    report.htmlLength = error.html?.length || 0;
    report.errorMessage = error.message || String(error);

    console.log(`HTTP success: no`);
    console.log(`HTTP status: ${report.statusCode ?? 'unknown'}`);
    console.log(`HTML length: ${report.htmlLength}`);
    console.log(`No candidates: source request failed.`);
    console.warn(`Error: ${report.errorMessage}`);

    return { report, candidates: [] };
  }
}

async function collectCandidates(sources) {
  const candidates = [];
  const debugReport = [];

  for (const source of sources) {
    const result = await inspectSource(source);
    candidates.push(...result.candidates);
    debugReport.push(result.report);
  }

  return { candidates, debugReport };
}

async function main() {
  const seedItems = readJson(exampleFeedPath);
  const sources = readJson(sourcesPath);
  const { candidates, debugReport } = await collectCandidates(sources);
  const generatedItems = dedupeItems([...seedItems, ...candidates]);

  writeJson(generatedFeedPath, generatedItems);
  writeJson(debugReportPath, debugReport);
  console.log(`\nWrote ${generatedItems.length} items to ${generatedFeedPath}`);
  console.log(`Wrote debug report to ${debugReportPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
