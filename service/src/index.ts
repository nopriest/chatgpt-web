/**
 * 其中，import 语句导入了 express 模块以及自定义的类型和函数。在创建应用程序时，使用了 express() 函数创建了一个 Express 应用程序实例，并将其赋值给变量 app。

接着，使用 express.Router() 创建了一个路由器实例，并将其赋值给变量 router。路由器是一种可以帮助处理 HTTP 请求的对象，它可以根据请求的 URL 和 HTTP 方法来选择要执行的代码。

使用 app.use() 和 router.post() 函数设置了对 /chat-process、/config、/session 和 /verify 路由的处理。这些路由都是 POST 请求，因此使用了 router.post() 帮助函数。

在路由上，也用到了 auth 中间件，这是一个用于身份验证的中间件函数，在处理每个请求之前都会检查是否提供了有效的身份验证令牌。

express.static() 用于将应用程序与位于 "public" 目录下的静态文件相关联。

express.json() 用于解析传入 JSON 数据的请求体。

在设置允许跨域资源共享（CORS）的响应头时，使用了通配符 "*" 来允许任何来源的请求。

在 /chat-process 路由上，读取了请求体中的提示和选项，并将其传递给 chatReplyProcess() 函数，该函数将使用 GPT 模型处理聊天，并通过响应流式传输聊天消息。

/config 路由用于获取 GPT 模型的配置设置，并将其发送回客户端。

/session 路由用于检查环境变量中是否设置了身份验证密钥，并向客户端发送指示是否启用了身份验证的响应。

/verify 路由用于验证身份验证令牌，并向客户端发送指示验证是否成功的响应。

最后，调用 app.listen() 函数，将应用程序绑定到端口 3002 上，以便能够处理来自客户端的请求。
 */
// 导入必要的模块和类型
import express from 'express'
import type { ChatContext, ChatMessage } from './chatgpt'
import { chatConfig, chatReplyProcess, currentModel } from './chatgpt'
import { auth } from './middleware/auth'
import { isNotEmptyString } from './utils/is'

// 创建一个 Express 应用程序
const app = express()

// 创建用于处理特定路由的路由器
const router = express.Router()

// 从 "public" 目录服务静态文件
app.use(express.static('public'))

// 解析请求体中的传入 JSON 数据
app.use(express.json())

// 为所有路由设置允许跨域资源共享（CORS）的响应头
app.all('*', (_, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'authorization, Content-Type')
  res.header('Access-Control-Allow-Methods', '*')
  next()
})

// 处理 POST 请求至 "/chat-process"
router.post('/chat-process', auth, async (req, res) => {
  // 设置响应头以指示响应为二进制文件
  res.setHeader('Content-type', 'application/octet-stream')

  try {
    // 从请求体中解析出提示和选项
    const { prompt, options = {} } = req.body as { prompt: string; options?: ChatContext }
    let firstChunk = true
    // 使用 GPT 模型处理聊天消息
    await chatReplyProcess(prompt, options, (chat: ChatMessage) => {
      // 将聊天消息流式传输回客户端
      res.write(firstChunk ? JSON.stringify(chat) : `\n${JSON.stringify(chat)}`)
      firstChunk = false
    })
  }
  catch (error) {
    // 将任何在聊天处理过程中遇到的错误发送回客户端
    res.write(JSON.stringify(error))
  }
  finally {
    // 结束响应流
    res.end()
  }
})

// 处理 POST 请求至 "/config"
router.post('/config', auth, async (req, res) => {
  try {
    // 获取 GPT 模型的配置设置
    const response = await chatConfig()
    res.send(response)
  }
  catch (error) {
    // 将任何在获取配置时遇到的错误发送回客户端
    res.send(error)
  }
})

// 处理 POST 请求至 "/session"
router.post('/session', async (req, res) => {
  try {
    // 检查环境变量中是否设置了身份验证密钥
    const AUTH_SECRET_KEY = process.env.AUTH_SECRET_KEY
    const hasAuth = isNotEmptyString(AUTH_SECRET_KEY)

    // 发送一个响应，指示是否启用了身份验证
    res.send({ status: 'Success', message: '', data: { auth: hasAuth, model: currentModel() } })
  }
  catch (error) {
    // 将任何在获取会话期间遇到的错误发送回客户端
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

// 处理 POST 请求至 "/verify"
router.post('/verify', async (req, res) => {
  try {
    // 从请求体中检索身份验证令牌
    const { token } = req.body as { token: string }
    // 检查令牌是否与环境变量中设置的身份验证密钥匹配
    if (!token)
      throw new Error('Secret key is empty')

    if (process.env.AUTH_SECRET_KEY !== token)
      throw new Error('密钥无效 | Secret key is invalid')

    // 发送一个响应，指示验证成功
    res.send({ status: 'Success', message: 'Verify successfully', data: null })
  }
  catch (error) {
    // 将任何在验证期间遇到的错误发送回客户端
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

// 将路由器挂载在应用程序上，使用基本路由 "" 和 "/api"
app.use('', router)
app.use('/api', router)

app.listen(3002, () => globalThis.console.log('Server is running on port 3002'))
