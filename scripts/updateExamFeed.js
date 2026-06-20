const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const exampleFeedPath = path.join(rootDir, 'data', 'exam-feed.example.json');
const generatedFeedPath = path.join(rootDir, 'data', 'exam-feed.generated.json');

const sourceConfigs = [
  {
    id: 'local-example-feed',
    type: 'local-json',
    path: exampleFeedPath,
  },
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function main() {
  const generatedItems = [];

  for (const source of sourceConfigs) {
    if (source.type === 'local-json') {
      generatedItems.push(...readJson(source.path));
      continue;
    }

    // Future hook:
    // Add official website checking logic here, such as fetching a sports bureau,
    // table tennis association, school, or training institution notice page,
    // then transforming verified official notices into ExamItem objects.
  }

  fs.mkdirSync(path.dirname(generatedFeedPath), { recursive: true });
  fs.writeFileSync(generatedFeedPath, `${JSON.stringify(generatedItems, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${generatedItems.length} items to ${generatedFeedPath}`);
}

main();
