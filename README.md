# 乒乓球考证报名雷达

这是一个基于 Expo SDK 54 的 React Native App，用来记录、筛选和提醒乒乓球相关证书考试报名信息。

## 运行 App

```bash
npm install
npx expo start --lan --clear
```

启动后，用手机 Expo Go 扫描二维码即可打开。

## 功能

- 首页显示今日提醒、即将截止、正在报名、最近新发现机会
- 全国机会列表支持按证书、地区、状态、时间筛选
- 我的关注只显示关注证书和关注地区
- 日历视图标记报名开始日、报名截止日、考试日
- 点击报名信息查看详情
- 只有 `official + verified + 真实链接` 才显示“查看官方通知 / 去报名”
- 示例数据会显示“示例数据，非真实报名通知”
- 未核验数据会显示“未核验，请以官方通知为准”
- 支持手动添加从公众号、学校群、体育局官网看到的报名线索

## 数据来源

当前 App 支持三类数据来源：

1. 本地数据：`src/data/examItems.ts`
2. 远程 JSON：由 `src/config/feedConfig.ts` 中的 `REMOTE_FEED_URL` 配置
3. GitHub Actions 生成数据：`data/exam-feed.generated.json`

远程读取逻辑在：

```text
src/services/fetchExamItems.ts
```

App 启动时会优先尝试读取远程 JSON。如果远程地址为空、请求失败或数据格式不正确，会自动回退到本地数据，不会导致 App 崩溃。

## 配置远程 JSON

打开：

```text
src/config/feedConfig.ts
```

把默认空字符串改成你的远程 JSON 地址：

```ts
export const REMOTE_FEED_URL = 'https://your-domain/path/exam-feed.generated.json';
```

`REMOTE_FEED_URL` 为空时表示不启用远程读取，App 会直接使用本地数据。

远程 JSON 可参考：

```text
data/exam-feed.example.json
```

每条数据必须包含：

```text
id, title, certificateType, province, city, organization,
registrationStartDate, registrationEndDate, examDate, location,
sourceUrl, status, isMock, verified, dataSourceType,
lastCheckedAt, note
```

## 自动更新框架

脚本：

```text
scripts/updateExamFeed.js
```

GitHub Actions：

```text
.github/workflows/update-exam-feed.yml
```

当前还不是完整爬虫，只是自动更新框架。脚本目前读取示例配置并输出：

```text
data/exam-feed.generated.json
```

以后可以在 `scripts/updateExamFeed.js` 中加入真实网站检查逻辑，例如检查官方体育局、乒协、学校、培训机构通知页面，再把核验后的通知转换为 App 的 `ExamItem` 数据。

GitHub Actions 每天北京时间上午 8 点左右运行一次，也支持手动触发 `workflow_dispatch`。如果生成的 `data/exam-feed.generated.json` 有变化，会自动提交到仓库。

## 安全规则

- 不把占位域名当作真实报名链接
- 没有真实官方链接的数据只显示“暂无官方链接”
- 示例数据必须标注“示例数据，非真实报名通知”
- 未核验数据必须标注“未核验，请以官方通知为准”
- 真实报名信息必须以官方体育局、乒协、学校、培训机构通知为准

## 版本

- Expo: `~54.0.0`
- React: `19.1.0`
- React Native: `0.81.5`

未新增第三方依赖，保持 Expo Go 兼容。
