const { createApp } = Vue

createApp({
  data() {
    return {
      username: "",
      password: ""
    }
  },
  methods: {
    async login() {
        if (this.username.trim() === "" || this.password === "") {
            alert("用户名和密码不能为空")
            return
        }
        if (this.password.length < 6) {
            alert("密码至少需要 6 个字符")
            return
        }
        try {
            const response = await axios.post(
            "https://genshin-todo.onrender.com/api/login",
            {
                username: this.username,
                password: this.password
            }
            )

            alert(response.data.message)

            this.username = ""
            this.password = ""

            localStorage.setItem(
                "currentUser",
                JSON.stringify(response.data.user)
            )
            window.location.href = "./index.html"
        } catch (error) {
            if (error.response) {
            alert(error.response.data.message)
            } else {
            alert("无法连接后端，请检查 node server.js 是否正在运行")
            }
        }
    }
}
}).mount("#login-app")