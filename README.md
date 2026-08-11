# 在线抠图 · 纯前端（通用 / 人像）

一个完全跑在浏览器里的 AI 抠图工具，无需后端、无需 API Key、图片不出本地。

- **通用抠图** 与 **人像抠图** 两种模式
- 抠图后**更换背景**：透明 / 白 / 红 / 灰 / 蓝（切换背景无需重新抠图）
- 一键**下载 PNG**
- 引擎 [`@imgly/background-removal`](https://github.com/imgly/background-removal-js)：浏览器内 ONNX + WASM 推理

## 目录结构

本项目采用「拆分免构建」结构（B 方案），CSS 与 JS 从 HTML 中抽出、分层存放：

```
cutout/
├── index.html   # 页面结构，引入下面的样式与脚本
├── style.css    # 全部样式（配色、布局、进度条、按钮等）
├── app.js       # 全部逻辑（上传 / 模式 / 背景 / 抠图 / 进度 / 下载），ES Module
└── README.md    # 本说明
```

> 抠图库通过 `app.js` 里的 `import ... from 'https://esm.sh/@imgly/background-removal@1.7.0'`
> 从外部 CDN 以浏览器原生 ES Module 方式加载，**无需打包、无需 Node 构建**。

## 版本

当前版本：**v1.2.0**（页脚可见）。每次更新代码都会升一档版本号（如 1.2.1、1.3.0…），
线上页面页脚的数字即代表生效版本，便于对照。

## 本地预览（可选，仅用于开发查看效果）

由于浏览器对 `file://` 下的 ES Module 有 CORS 限制，请用一个静态服务器打开，而**不要直接双击**：

```bash
# 进入项目目录后，任选其一：
python3 -m http.server 8000        # 多数 Mac 可用（需装了 Python 3）
python -m SimpleHTTPServer 8000    # 系统自带 Python 2 的 Mac 可用
```

然后浏览器访问 `http://localhost:8000/`。

> 部署到 GitHub Pages 不必本地预览，直接提交即可，构建托管全在 GitHub 侧。

## 部署到 GitHub Pages（Deploy from branch）

适合**无需修改 Pages 设置**的静态托管方式。

1. 在 GitHub 网页新建空仓库（如 `cutout-web`），**公开**。
2. 打开仓库 **Settings → Pages**：
   - Source 选 **`Deploy from branch`**
   - Branch 选 **`main`**，文件夹 **`/ (root)`**
   - 保存
3. 把本仓库的四个文件（`index.html` / `style.css` / `app.js` / `README.md`）放到仓库**根目录**，提交并推送。
4. 约 1 分钟后访问 `https://<用户名>.github.io/<仓库名>/`。
   首次打开会联网从 CDN 加载抠图库、下载约 40MB 模型，稍慢，之后浏览器缓存。

## 后续更新（固定动作）

1. 拿到新的部署包（如 `cutout-deploy.tar.gz`），解压得到 `index.html` / `style.css` / `app.js` / `README.md`。
2. 拷贝覆盖到你本地仓库根目录（注意是根目录，不是子目录）。
3. 提交并推送：

```bash
cd /path/to/cutout-web
git add -A
git commit -m "更新到 vX.Y.Z"
git push
```

4. 等约 1 分钟，浏览器**强制刷新**（Cmd+Shift+R）确认页脚版本号与预期一致。

> 远程仓库的 Pages 设置只需配置一次，之后每次 push 自动重新部署，无需再动。

## 隐私

图片全程在浏览器本地处理，不会上传到任何服务器。
