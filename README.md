# Daguanyuan Bridge

Daguanyuan Bridge 是一个 MarginNote 4 插件，用于把大观园数学题库和 408 真题当前打开的练习分类导入为脑图卡片。

## 当前测试范围

- 在插件 WebView 中打开大观园并由用户自行扫码登录。
- 用户打开一个练习分类后，点击标题栏的“导入当前分类”。
- 插件创建 `Daguanyuan Bridge → 分类 → 题目` 脑图层级。
- 题目卡片保存题源、页面题干、LaTeX 和原题链接。
- 重复导入时按大观园题目 ID 跳过已有卡片。
- 题目内容以 Markdown 保存，网页图片保留为图片链接。

插件不会读取或导出 Cookie，不会自动作答或修改网站掌握状态，也不会后台抓取题库。

## 验证

```powershell
npm test
npm run build
npm run build:release
```

测试构建只生成 `Daguanyuan Bridge Test.mnaddon`。
正式构建生成带版本号的安装包；如果同名正式包已存在，构建会停止并拒绝覆盖。
