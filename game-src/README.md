<!-- This README explains how to run the game and which files are fun to tweak. -->
# 🐉 小北寻龙记 - 游戏源码

## 运行方法
```bash
cd game-src
python3 -m http.server 8080
# 打开浏览器访问 http://localhost:8080
```

## 当前版本 V1
- ✅ 主菜单
- ✅ 武当山关卡（可玩）
- ✅ Minecraft 风格热键栏
- ✅ 太极拳习得系统
- ✅ 灵体敌人与回血灵珠
- ⬜ 嵩山关卡（旅途中开发）
- ⬜ 龙宫终章（敬请期待）

## 开发指南
每个文件都有注释，小北可以尝试修改：
- `src/constants.js` → 改变玩家速度、跳跃高度
- `src/scenes/WudangScene.js` → 调整平台位置
- `src/entities/Player.js` → 改变攻击和技能效果
- `src/ui/HotbarUI.js` → 改变热键栏颜色和布局

## 文件说明
- `index.html`：浏览器入口页
- `src/main.js`：启动 Phaser 游戏
- `src/scenes/BootScene.js`：程序生成全部像素贴图
- `src/scenes/MenuScene.js`：主菜单
- `src/scenes/WudangScene.js`：武当山可玩关卡
- `src/scenes/HUDScene.js`：血量、地点、提示、热键栏

## 小提示
- 第 6 格是太极拳，学会后按 `6` 选中，再按 `K` 使用。
- 如果掉血归零，会回到山脚重新出发。
- 刷新浏览器可以从头开始一轮旅程。
