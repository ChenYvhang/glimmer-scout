# 团队协作操作指南 / 팀 협업 가이드

> 写给完全没用过 GitHub 的队友。跟着做就行，不需要提前"学会" Git。
> GitHub을 한 번도 안 써본 팀원을 위한 문서입니다. 미리 Git을 "배울" 필요 없이,
> 그대로 따라 하기만 하면 됩니다.

---

## 目录 / 목차

0. [你需要准备什么 / 준비물](#0-你需要准备什么--준비물)
1. [几个概念（先看这个）/ 몇 가지 개념 (먼저 읽어보세요)](#1-几个概念先看这个--몇-가지-개념-먼저-읽어보세요)
2. [第一次设置（只做一次）/ 최초 설정 (한 번만 하면 됩니다)](#2-第一次设置只做一次--최초-설정-한-번만-하면-됩니다)
3. [日常协作流程（每次都这样做）/ 일상적인 협업 흐름 (매번 이렇게 하세요)](#3-日常协作流程每次都这样做--일상적인-협업-흐름-매번-이렇게-하세요)
4. [不想用命令行？用 GitHub Desktop / 명령어가 부담스럽다면 GitHub Desktop](#4-不想用命令行用-github-desktop--명령어가-부담스럽다면-github-desktop)
5. [本项目的特别注意事项 / 이 프로젝트의 특별 주의사항](#5-本项目的特别注意事项--이-프로젝트의-특별-주의사항)
6. [常见问题 / 자주 묻는 질문](#6-常见问题--자주-묻는-질문)
7. [命令速查表 / 명령어 치트시트](#7-命令速查表--명령어-치트시트)

---

## 0. 你需要准备什么 / 준비물

**中文：**
1. 一个 GitHub 账号（[github.com](https://github.com) 免费注册）。
2. 把你的 GitHub 用户名发给项目负责人（仓库拥有者），让 TA 在仓库的
   `Settings → Collaborators` 里把你添加为协作者。你会收到一封邮件邀请，点击接受。
3. 在电脑上安装 **Git**：
   - Windows：<https://git-scm.com/download/win>，一路下一步安装即可。
   - Mac：终端输入 `git --version`，如果没装会提示自动安装。
4. （可选，但强烈推荐新手用）安装 **GitHub Desktop**（图形界面，不用敲命令）：
   <https://desktop.github.com/>

**한국어：**
1. GitHub 계정 하나 ([github.com](https://github.com) 에서 무료 가입).
2. 본인의 GitHub 아이디를 프로젝트 담당자(저장소 소유자)에게 알려주고,
   `Settings → Collaborators` 메뉴에서 협업자로 추가해달라고 요청하세요.
   초대 이메일이 오면 수락(Accept)하면 됩니다.
3. 컴퓨터에 **Git** 설치:
   - Windows: <https://git-scm.com/download/win> 에서 다운로드 후 계속 다음(Next)만 누르면 됩니다.
   - Mac: 터미널에 `git --version` 입력 시 설치 안내가 뜨면 그대로 설치하세요.
4. (선택이지만 초보자에게 강력 추천) **GitHub Desktop** 설치 (명령어 없이 그래픽으로 조작):
   <https://desktop.github.com/>

---

## 1. 几个概念（先看这个）/ 몇 가지 개념 (먼저 읽어보세요)

**中文：**

| 术语 | 大白话解释 |
|---|---|
| **仓库 Repository / repo** | 这个项目的所有文件 + 修改历史，存在 GitHub 上的一个"文件夹" |
| **克隆 Clone** | 把 GitHub 上的仓库完整下载一份到你自己的电脑上 |
| **分支 Branch** | 一条独立的"时间线"。`main` 分支是正式、稳定的版本；每个人开发新功能时，
应该开一条**自己的分支**，改完确认没问题再合并回 `main`，这样不会互相覆盖 |
| **提交 Commit** | 把你改的内容"存一个存档点"，并写一句话说明"这次改了什么" |
| **推送 Push** | 把你电脑上的存档点上传到 GitHub |
| **拉取 Pull** | 把 GitHub 上别人（或你自己之前）的修改下载到你电脑上，保持同步 |
| **Pull Request（PR）** | 你在 GitHub 网页上发起的一个"申请"："我这条分支改好了，请把它合并到 main"。
队友可以在 PR 页面看你改了什么、留评论，负责人确认没问题后点击合并 |

**一句话总结工作方式**：**永远不要直接在 `main` 分支上改东西**。每次开发前先拉一条自己的
分支，改完发 Pull Request，让别人看过、没问题再合并。这样即使你改错了，`main` 分支上
线上能跑的版本也不会被破坏。

**한국어：**

| 용어 | 쉬운 설명 |
|---|---|
| **저장소 Repository / repo** | 이 프로젝트의 모든 파일 + 수정 이력이 저장된, GitHub 상의 "폴더" |
| **클론 Clone** | GitHub에 있는 저장소 전체를 내 컴퓨터로 그대로 다운로드하는 것 |
| **브랜치 Branch** | 독립된 "타임라인" 하나. `main` 브랜치는 정식으로 배포되는 안정 버전이고,
새 기능을 개발할 때는 **자기만의 브랜치**를 만들어서 작업한 뒤, 문제없는지 확인하고
`main`에 합치는 것이 원칙입니다. 이렇게 하면 서로의 작업을 덮어쓰지 않습니다 |
| **커밋 Commit** | 수정한 내용을 "저장 포인트"로 남기고, "이번에 무엇을 바꿨는지" 한 줄로
기록하는 것 |
| **푸시 Push** | 내 컴퓨터에 있는 저장 포인트를 GitHub에 업로드하는 것 |
| **풀 Pull** | GitHub에 있는 다른 사람(또는 내가 이전에 올린) 수정 내용을 내 컴퓨터로
다운로드해서 동기화하는 것 |
| **풀 리퀘스트 Pull Request (PR)** | GitHub 웹페이지에서 올리는 일종의 "신청서":
"제 브랜치에서 작업을 마쳤으니 main에 합쳐주세요." 팀원들이 PR 페이지에서 변경 내용을
보고 댓글을 남길 수 있고, 담당자가 문제없다고 확인하면 병합(merge)합니다 |

**한 줄 요약**: **`main` 브랜치에서 절대 직접 작업하지 마세요.** 작업을 시작하기 전에
항상 자기만의 브랜치를 새로 만들고, 작업이 끝나면 Pull Request를 올려서 다른 사람이
검토한 뒤 병합하도록 하세요. 이렇게 하면 실수로 코드를 망가뜨려도 실제 배포되는
`main` 브랜치는 안전합니다.

---

## 2. 第一次设置（只做一次）/ 최초 설정 (한 번만 하면 됩니다)

### 2.1 告诉 Git 你是谁 / Git에게 내가 누구인지 알려주기

打开终端（Windows 用 Git Bash，Mac 用「终端」App），输入：
터미널을 열고 (Windows는 Git Bash, Mac은 「터미널」 앱), 아래를 입력하세요:

```bash
git config --global user.name "你的名字/이름"
git config --global user.email "你的GitHub注册邮箱/GitHub 가입 이메일"
```

### 2.2 克隆仓库到你的电脑 / 저장소를 내 컴퓨터로 클론하기

**中文**：先在网页上打开仓库地址 `https://github.com/ChenYvhang/glimmer-scout`，点击绿色
的 **Code** 按钮，复制 HTTPS 链接。然后在终端里，`cd` 到你想放项目的文件夹，输入：

**한국어**: 먼저 웹브라우저에서 저장소 주소 `https://github.com/ChenYvhang/glimmer-scout`
를 열고, 초록색 **Code** 버튼을 눌러 HTTPS 링크를 복사하세요. 그다음 터미널에서 프로젝트를
저장할 폴더로 `cd` 이동한 뒤 다음을 입력합니다:

```bash
git clone https://github.com/ChenYvhang/glimmer-scout.git
cd glimmer-scout
```

第一次 push 时，GitHub 会要求你登录——不能用密码，要用 **Personal Access Token**（相当于
密码的替代品）。生成方法：GitHub 网页右上角头像 → `Settings` → 左侧最下方
`Developer settings` → `Personal access tokens` → `Tokens (classic)` → `Generate new token`，
勾选 `repo` 权限，生成后**立刻复制保存**（只显示一次）。之后 Git 弹出登录框时，用户名填
GitHub 用户名，密码填这个 token。

첫 push를 할 때 GitHub이 로그인을 요구하는데, 비밀번호가 아니라 **Personal Access
Token**(비밀번호 대체 토큰)을 사용해야 합니다. 생성 방법: GitHub 우측 상단 프로필 →
`Settings` → 왼쪽 맨 아래 `Developer settings` → `Personal access tokens` →
`Tokens (classic)` → `Generate new token`에서 `repo` 권한을 체크하고 생성한 뒤
**바로 복사해서 저장**하세요 (한 번만 보여줍니다). 이후 Git이 로그인 창을 띄우면
사용자 이름에는 GitHub 아이디, 비밀번호 칸에는 이 토큰을 입력하면 됩니다.

---

## 3. 日常协作流程（每次都这样做）/ 일상적인 협업 흐름 (매번 이렇게 하세요)

### 第①步：开始工作前，先同步最新代码 / ① 작업 시작 전, 최신 코드로 동기화

```bash
git checkout main
git pull origin main
```

### 第②步：给自己开一条新分支 / ② 나만의 새 브랜치 만들기

分支名建议格式：`你的名字/这次做的事`，比如 `xiaoming/fix-scatter-tooltip`。

브랜치 이름 형식 추천: `이름/작업내용`, 예: `xiaoming/fix-scatter-tooltip`.

```bash
git checkout -b xiaoming/fix-scatter-tooltip
```

### 第③步：正常修改文件 / ③ 평소대로 파일 수정하기

用你熟悉的编辑器（VS Code 等）改代码就行，跟平时写代码没区别。

평소 사용하던 에디터(VS Code 등)로 코드를 수정하면 됩니다. 평소와 다를 게 없습니다.

### 第④步：把修改保存成一个"存档点" / ④ 수정 내용을 "저장 포인트"로 만들기

```bash
git status                        # 看看改了哪些文件 / 어떤 파일이 바뀌었는지 확인
git add 具体改过的文件名             # 例如：git add web/src/App.tsx
git commit -m "一句话说明改了什么"   # 例如："修复散点图悬停提示不消失的问题"
```

> ⚠️ **不要用 `git add .` 或 `git add -A`**（会把所有文件不加区分地打包提交，容易
> 误提交不该提交的东西，比如密钥文件）。养成"逐个文件确认"的习惯。
>
> ⚠️ **`git add .` 나 `git add -A`는 사용하지 마세요** (모든 파일을 구분 없이 한꺼번에
> 커밋하게 되어, 키 파일 같은 것을 실수로 커밋할 위험이 있습니다). 파일을 하나씩
> 확인하고 추가하는 습관을 들이세요.

### 第⑤步：推送到 GitHub / ⑤ GitHub에 푸시하기

```bash
git push origin xiaoming/fix-scatter-tooltip
```

第一次推送这条分支时，终端会提示你复制一行带 `--set-upstream` 的命令，照着执行一次即可
（以后同一条分支直接 `git push` 就行）。

이 브랜치를 처음 푸시할 때, 터미널에 `--set-upstream`이 포함된 명령어를 복사해서 실행하라는
안내가 뜹니다. 한 번만 그대로 실행하면 됩니다 (이후에는 같은 브랜치에서 그냥 `git push`만
하면 됩니다).

### 第⑥步：在 GitHub 网页上发起 Pull Request / ⑥ GitHub 웹에서 Pull Request 만들기

**中文**：推送成功后，打开仓库网页 `https://github.com/ChenYvhang/glimmer-scout`，通常会
自动弹出一个黄色提示条 "Compare & pull request"，点它。填写标题和简单说明（改了什么、
为什么改），确认 base 分支是 `main`，点击 **Create pull request**。

**한국어**: 푸시가 성공하면 저장소 웹페이지 `https://github.com/ChenYvhang/glimmer-scout`
를 여세요. 보통 노란색 "Compare & pull request" 알림이 자동으로 뜨는데, 그걸 클릭하세요.
제목과 간단한 설명(무엇을 바꿨는지, 왜 바꿨는지)을 작성하고, base 브랜치가 `main`인지
확인한 뒤 **Create pull request**를 클릭합니다.

### 第⑦步：等待review、合并 / ⑦ 리뷰를 기다리고 병합하기

其他人（或项目负责人）会在 PR 页面看你的改动、留评论。确认没问题后，点击
**Merge pull request** 合并进 `main`。合并完可以点击 **Delete branch** 删掉这条临时分支
（不影响你电脑上的代码）。

다른 사람(또는 프로젝트 담당자)이 PR 페이지에서 변경 사항을 확인하고 댓글을 남길 수
있습니다. 문제없다고 확인되면 **Merge pull request**를 눌러 `main`에 병합합니다.
병합 후에는 **Delete branch**를 눌러 임시 브랜치를 지워도 됩니다 (내 컴퓨터의 코드에는
영향 없습니다).

之后回到"第①步"，继续下一个任务。

이후 다시 "① 단계"로 돌아가서 다음 작업을 시작하면 됩니다.

---

## 4. 不想用命令行？用 GitHub Desktop / 명령어가 부담스럽다면 GitHub Desktop

如果敲命令让你紧张，**GitHub Desktop** 是一个图形界面工具，上面第 3 节的每一步都有对应的
按钮，不用记命令：

| 命令行操作 | GitHub Desktop 里对应的按钮 |
|---|---|
| `git clone` | 打开 App → `File → Clone Repository` |
| `git pull` | 顶部 `Fetch origin` / `Pull origin` 按钮 |
| `git checkout -b` | 顶部 `Current Branch` 下拉框 → `New Branch` |
| `git add` + `git commit` | 左侧勾选改动的文件 → 下方填提交说明 → `Commit to 分支名` |
| `git push` | 顶部 `Push origin` 按钮 |
| 发起 Pull Request | push 后点顶部 `Create Pull Request`，会自动跳转到浏览器 |

명령어가 부담스럽다면, **GitHub Desktop**은 위 3번 항목의 모든 단계를 버튼 클릭으로
대신할 수 있는 그래픽 도구입니다:

| 명령어 작업 | GitHub Desktop에서 해당하는 버튼 |
|---|---|
| `git clone` | 앱 실행 → `File → Clone Repository` |
| `git pull` | 상단의 `Fetch origin` / `Pull origin` 버튼 |
| `git checkout -b` | 상단 `Current Branch` 드롭다운 → `New Branch` |
| `git add` + `git commit` | 왼쪽에서 변경된 파일 체크 → 아래에 커밋 메시지 입력 →
`Commit to 브랜치이름` |
| `git push` | 상단의 `Push origin` 버튼 |
| Pull Request 만들기 | push 후 상단의 `Create Pull Request` 클릭 시 브라우저로 자동 이동 |

---

## 5. 本项目的特别注意事项 / 이 프로젝트의 특별 주의사항

**中文：**

1. **`.env` 文件绝对不要提交**（也不需要提交）。它里面是 API 密钥（YouTube/智谱/
   DeepSeek），一旦推到公开仓库上会被恶意盗用。这个文件已经写进 `.gitignore`，正常操作
   不会提交它，但如果 `git status` 里看到 `.env` 出现在改动列表里，**不要 add/commit 它**，
   先来问一下项目负责人。
2. **`web/public/dataset.json` 是自动生成的文件，不要手改**。它是跑
   `python -m pipeline.build` 之后生成的，如果你是负责数据管道（pipeline）那部分的人，
   改完 `pipeline/` 里的代码后重新跑一次 build 再提交这个文件；如果你是只负责前端页面的人，
   一般不需要动这个文件。
3. **这个文件很大（约 60MB）**，`git push` 可能要几十秒到几分钟，看到进度条转着不要以为
   卡住了。GitHub 会提示"文件超过 50MB 建议用 Git LFS"，这是警告不是错误，可以先不用管，
   push 依然会成功。
4. **`pipeline/cache/`、`pipeline/artifacts/`、`pipeline/raw/`、`.venv/`、
   `web/node_modules/`、`web/dist/` 都已经在 `.gitignore` 里**，`git status` 不会看到它们，
   不用担心误提交。
5. **分工建议**：负责 `pipeline/` Python 代码的人和负责 `web/` 前端代码的人，改动的文件
   基本不重叠，冲突概率很低。如果两人都要改同一个文件（比如 `web/src/lib/schema.ts`），
   提前在群里说一声，谁先改完先发 PR、合并后另一人再拉最新代码。
6. **不要用 `git push --force`**（强制推送）。这会覆盖别人在远程仓库上的提交，可能导致
   队友的工作丢失。如果 push 失败提示"rejected"，先 `git pull` 同步别人的最新改动，
   解决完冲突（见下方 FAQ）再 push。

**한국어：**

1. **`.env` 파일은 절대 커밋하지 마세요** (커밋할 필요도 없습니다). 이 파일에는
   API 키(YouTube/Zhipu/DeepSeek)가 들어있어서, 공개 저장소에 올라가면 악용될 수
   있습니다. 이 파일은 이미 `.gitignore`에 등록되어 있어 정상적으로는 커밋되지 않지만,
   만약 `git status`에서 `.env`가 변경 목록에 보인다면 **절대 add/commit 하지 말고**
   먼저 프로젝트 담당자에게 문의하세요.
2. **`web/public/dataset.json`은 자동 생성 파일이므로 직접 수정하지 마세요.** 이 파일은
   `python -m pipeline.build`를 실행하면 생성됩니다. 데이터 파이프라인(pipeline)을
   담당하는 사람이라면 `pipeline/` 코드를 수정한 뒤 build를 다시 실행하고 이 파일을
   커밋하면 되고, 프론트엔드만 담당하는 사람이라면 보통 이 파일을 건드릴 필요가 없습니다.
3. **이 파일은 용량이 큽니다 (약 60MB)**, `git push`에 수십 초에서 몇 분이 걸릴 수
   있으니 진행 바가 오래 돌아도 멈춘 게 아닙니다. GitHub이 "파일이 50MB를 넘으니 Git
   LFS를 사용하라"는 경고를 띄우는데, 이건 경고일 뿐 오류가 아니며 무시해도 push는
   정상적으로 성공합니다.
4. **`pipeline/cache/`, `pipeline/artifacts/`, `pipeline/raw/`, `.venv/`,
   `web/node_modules/`, `web/dist/`는 모두 `.gitignore`에 등록되어 있습니다.**
   `git status`에 보이지 않으니 실수로 커밋될 걱정은 안 하셔도 됩니다.
5. **역할 분담 제안**: `pipeline/` Python 코드 담당자와 `web/` 프론트엔드 담당자는
   수정하는 파일이 거의 겹치지 않아 충돌 가능성이 낮습니다. 만약 두 사람이 같은
   파일(예: `web/src/lib/schema.ts`)을 수정해야 한다면, 미리 채팅방에서 이야기하고
   먼저 끝낸 사람이 PR을 올려 병합한 뒤 다른 사람이 최신 코드를 pull 받으세요.
6. **`git push --force`(강제 푸시)는 사용하지 마세요.** 다른 사람이 원격 저장소에
   올린 커밋을 덮어써서 팀원의 작업이 사라질 수 있습니다. push가 "rejected"라고
   실패하면, 먼저 `git pull`로 다른 사람의 최신 변경 사항을 받아온 뒤 충돌을 해결하고
   (아래 FAQ 참고) 다시 push하세요.

---

## 6. 常见问题 / 자주 묻는 질문

**中文：**

**Q：`git push` 报错 "Updates were rejected because the remote contains work that you
do not have locally"？**
A：说明别人已经往这条分支/`main` 推送过新东西，你本地是旧的。运行 `git pull`，
Git 会自动合并；如果同一处代码两边都改了，会提示"冲突（conflict）"，需要手动打开冲突文件，
里面会有 `<<<<<<<` `=======` `>>>>>>>` 标记出两边的版本，手动删掉标记、留下你想要的内容，
保存后 `git add 文件名` → `git commit` 即可。如果不确定怎么处理，截图冲突内容问项目负责人，
不要瞎删。

**Q：不小心在 `main` 分支上直接改了代码，还没 commit，怎么办？**
A：先别 commit。运行 `git stash`（把改动临时收起来），然后按第 3 节新建一条分支，
再运行 `git stash pop`（把改动放回来），这样改动就转移到了新分支上。

**Q：commit 时提示要填 "Please enter a commit message"，跳出一个命令行编辑器（vim），
不知道怎么退出？**
A：这是 vim 编辑器。按 `Esc` 键，然后输入 `:wq` 再按回车，就能保存退出。或者以后用
`git commit -m "你的说明"` 这种写法，就不会跳出编辑器。

**Q：我不小心把 API 密钥 / `.env` 文件提交并推送上去了怎么办？**
A：立刻告诉项目负责人，需要**重新生成/吊销**那几个 API key（而不是简单删掉文件——
Git 历史里还留着记录），负责人会处理。

**한국어：**

**Q: `git push`할 때 "Updates were rejected because the remote contains work that you
do not have locally" 오류가 나요?**
A: 다른 사람이 이미 이 브랜치/`main`에 새 커밋을 올렸고, 내 로컬은 오래된 상태라는
뜻입니다. `git pull`을 실행하면 Git이 자동으로 병합합니다. 만약 같은 부분을 양쪽에서
수정했다면 "충돌(conflict)"이 뜨는데, 충돌 파일을 열어보면 `<<<<<<<` `=======`
`>>>>>>>` 표시로 양쪽 버전이 나뉘어 있습니다. 표시를 지우고 원하는 내용만 남긴 뒤
저장하고 `git add 파일명` → `git commit`을 하면 됩니다. 처리 방법이 확실치 않다면
충돌 내용을 캡처해서 담당자에게 물어보세요. 함부로 지우지 마세요.

**Q: 실수로 `main` 브랜치에서 바로 코드를 수정했는데 아직 커밋 안 했어요. 어떻게 하나요?**
A: 아직 커밋하지 마세요. `git stash`(수정 내용을 임시로 보관)를 실행한 뒤, 3번 항목대로
새 브랜치를 만들고, `git stash pop`(보관해둔 수정 내용을 다시 꺼내기)을 실행하면
수정 내용이 새 브랜치로 옮겨집니다.

**Q: 커밋할 때 "Please enter a commit message"라며 vim이라는 명령줄 편집기가
뜨는데 나가는 법을 모르겠어요.**
A: vim 편집기입니다. `Esc` 키를 누른 뒤 `:wq`를 입력하고 엔터를 누르면 저장하고
나갈 수 있습니다. 또는 앞으로 `git commit -m "설명"` 형식으로 쓰면 편집기가
뜨지 않습니다.

**Q: API 키 / `.env` 파일을 실수로 커밋하고 push까지 해버렸어요.**
A: 즉시 프로젝트 담당자에게 알리세요. 해당 API 키들을 **재발급/폐기**해야 합니다
(파일만 삭제하는 것으로는 부족합니다 — Git 기록에 남아있기 때문입니다). 담당자가
처리할 것입니다.

---

## 7. 命令速查表 / 명령어 치트시트

```bash
# 同步最新代码 / 최신 코드 동기화
git checkout main
git pull origin main

# 新建并切换到自己的分支 / 새 브랜치 생성 및 전환
git checkout -b 你的名字/任务名

# 查看改了哪些文件 / 변경된 파일 확인
git status

# 查看具体改了什么内容 / 구체적으로 무엇이 바뀌었는지 확인
git diff

# 提交改动 / 변경 사항 커밋
git add 文件名
git commit -m "说明这次改了什么"

# 推送到 GitHub / GitHub에 푸시
git push origin 你的分支名

# 切回 main 分支 / main 브랜치로 돌아가기
git checkout main

# 查看提交历史 / 커밋 기록 보기
git log --oneline -10
```

---

有任何步骤卡住了，直接截图报错信息问项目负责人或队友，**不要自己瞎猜着删文件/强制操作**——
Git 几乎所有操作都可以撤销，但前提是先问清楚现在是什么状态。

어떤 단계에서든 막히면 오류 메시지를 캡처해서 프로젝트 담당자나 팀원에게 바로 물어보세요.
**임의로 파일을 지우거나 강제 명령을 실행하지 마세요** — Git의 거의 모든 작업은 되돌릴
수 있지만, 그러려면 먼저 지금 상태가 어떤지 정확히 파악해야 합니다.
