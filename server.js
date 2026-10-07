const { DatabaseSync } = require("node:sqlite") // SQLite 数据库工具
const http = require("node:http")
const crypto = require("node:crypto")  //node自带 保存到变量crypto
const db = new DatabaseSync("todo.db")

db.exec(`
  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0
  )
`)

// 后端启动
// → 检查 todos 表有没有 user_id
// → 没有：添加 user_id
// → 有：不做任何事
const todoColumns = db
    .prepare("PRAGMA table_info(todos)")//特殊查询 todo表有多少列
    .all()
const hasUserId = todoColumns.some(
  (column) => column.name === "user_id"//检查列
)
if (!hasUserId) {
  db.exec("ALTER TABLE todos ADD COLUMN user_id INTEGER")
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,  
    password_hash TEXT NOT NULL
  )
`)//UNIQUE表示不能有两个用户使用同一个用户名


// 读取 Axios 请求中的 data 内容。
function readBody(req) {
  return new Promise((resolve) => {
    let body = ""

    req.on("data", (chunk) => {
      body += chunk
    })

    req.on("end", () => {
      resolve(JSON.parse(body))
    })
  })
}
function hashPassword(password){
  //在这里加密
  //生成16个随机字节然后转成十六进制
  const salt = crypto.randomBytes(16).toString("hex") 
  //使用 Node.js 的 scrypt 密码哈希算法
  const hash = crypto.scryptSync(password, salt, 64).toString("hex")
  return `${salt}:${hash}`
}

function verifyPassword(password, storedPasswordHash) {
  const [salt, storedHash] = storedPasswordHash.split(":") //.split(":")会按冒号切开字符串
  const hash = crypto
    .scryptSync(password, salt, 64)  //["盐值", "哈希值"]
    .toString("hex")
  
  return crypto.timingSafeEqual(
    Buffer.from(hash, "hex"),
    Buffer.from(storedHash, "hex")
  )
}

const server = http.createServer(async (req, res) => {
  // 允许前端页面访问这个后端。
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")

  // 浏览器的跨域预检请求。
  if (req.method === "OPTIONS") {
    res.writeHead(204)
    res.end()
    return
  }

  // 查
  if (req.method === "GET" && req.url.startsWith("/api/todos")) {
    const url = new URL(req.url, "http://localhost:3000")
    const userId = url.searchParams.get("userId")//取出地址里的用户编号。
    const todos = db
      .prepare("SELECT id, text, done FROM todos WHERE user_id = ?")
      .all(userId)

    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8"
    })
    res.end(JSON.stringify(todos))
    return
  }

  // 增
  if (req.method === "POST" && req.url === "/api/todos") {
    const data = await readBody(req)
    const text = data.text
    const userId = data.userId
    //加入输入校验
    if(!text || text.trim() === ""){
      res.writeHead(400,{
        "Content-Type": "application/json; charset=utf-8"
      })
      res.end(JSON.stringify({
        message: "任务不能为空"
      }))

    }

    db
      .prepare("INSERT INTO todos (text, user_id) VALUES (?, ?)")
      .run(text, userId)

    res.writeHead(201, {
      "Content-Type": "application/json; charset=utf-8"
    })
    res.end(JSON.stringify({
      message: "任务添加成功"
    }))
    return
  }

  // 删
  if (req.method === "POST" && req.url === "/api/todos/delete") {
    const data = await readBody(req)
    const id = data.id

    db.prepare("DELETE FROM todos WHERE id = ?").run(id)

    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8"
    })
    res.end(JSON.stringify({
      message: "任务删除成功"
    }))
    return
  }

  //改
  if(req.method === "POST" && req.url === "/api/todos/update"){
    const data = await readBody(req)
    const id = data.id
    const done = data.done

    db
      .prepare("UPDATE todos SET done = ? WHERE id = ?")
      .run(done ? 1 : 0, id)//是 true  → 保存 1   是 false → 保存 0

    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8"
    })
    res.end(JSON.stringify({
      message: "任务状态更新成功"
    }))
    return
  }
  //改任务文本
  if (req.method === "POST" && req.url === "/api/todos/edit-text") {
    // 这里修改任务
    const data=await readBody(req)
    const id = data.id
    const text = data.text  //id与text 
    

    db
      .prepare("UPDATE todos SET text = ? WHERE id = ?")
      .run(text, id) //执行这个任务

    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8"
    })
    res.end(JSON.stringify({
      message: "任务文字修改成功"
    }))

    return
  }

  if (req.method === "POST" && req.url === "/api/register") {
    // 在这里处理用户注册
    const data = await readBody(req) //前端提交的完整对象
    const username = data.username
    const password = data.password

    if (!username || !password || username.trim() === ""){
      res.writeHead(400, {
        "Content-Type": "application/json; charset=utf-8"
      })
      res.end(JSON.stringify({
        message: "用户名和密码不能为空"
      }))
      return
    }
    if (password.length < 6) {
      res.writeHead(400, {
        "Content-Type": "application/json; charset=utf-8"
      })
      res.end(JSON.stringify({
        message: "密码至少需要 6 个字符"
      }))
      return
    }
    const existingUser = db
      .prepare("SELECT id FROM users WHERE username = ?")
      .get(username.trim())
    if (existingUser) {
      res.writeHead(409, {
        "Content-Type": "application/json; charset=utf-8"
      })
      res.end(JSON.stringify({
        message: "用户名已存在"
      }))
      return
    }

    const passwordHash = hashPassword(password)
    db
      .prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)")
      .run(username.trim(), passwordHash)
    
    res.writeHead(201, {
      "Content-Type": "application/json; charset=utf-8"
    })
    res.end(JSON.stringify({
      message: "注册成功"
    }))
    return 
  }
  if (req.method === "POST" && req.url === "/api/login") {
    const data = await readBody(req)
    const username = data.username
    const password = data.password
    //查询用户并验证密码
    const user = db
      .prepare(
        "SELECT id, username, password_hash FROM users WHERE username = ?"
      )
        .get(username.trim())
      if (!user) {
        res.writeHead(401, {
          "Content-Type": "application/json; charset=utf-8"
        })
        res.end(JSON.stringify({
          message: "用户名或密码错误"
        }))
        return
      }
      const passwordCorrect = verifyPassword(
        password,
        user.password_hash
      )
      if (!passwordCorrect) {
        res.writeHead(401, {
        "Content-Type": "application/json; charset=utf-8"
      })
      res.end(JSON.stringify({
        message: "用户名或密码错误"
      }))
      return
      }
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8"
      })
      res.end(JSON.stringify({
        message: "登录成功",
        user: {
          id: user.id,
          username: user.username
        }
      }))
      return
      }
  // 没有匹配的接口时，返回 404。
  res.writeHead(404, {
    "Content-Type": "text/plain; charset=utf-8"
  })
  res.end("接口不存在")
})

server.listen(process.env.PORT || 3000, () => {
  console.log("后端服务器已启动：http://localhost:3000")
})
