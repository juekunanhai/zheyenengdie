# 1C 微信本地构建配置草案

仅创建独立的微信调试构建参数文件，不改 Web 参数、物理配置或现有场景逻辑。尚未执行。

```json
{
  "platform": "wechatgame",
  "taskName": "wechatgame",
  "debug": true,
  "packages": {
    "wechatgame": {
      "appid": "wxc0360e0c829a3307",
      "orientation": "portrait"
    }
  }
}
```

拟保存为 preparation/platform/wechat-build.json，并通过 Creator 官方 configPath 参数构建到 build/wechatgame。Creator 可自动保存本地构建任务 profile；实际变更会记录。该步骤仅本地构建与导入开发者工具，不上传代码、发布或生成需要上传的预览二维码。

字段依据：https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/publish-wechatgame.html 与命令行构建文档。
