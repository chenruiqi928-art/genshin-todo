
    const { createApp } = Vue   // 创建 Vue 应用
    createApp({
        data(){
            return{
                newTodo:"", // 输入框文字
                // 待办数组 todos
                todos:[],
                errorMessage: "",
                currentUser: null
            }
        },
        mounted(){
            const savedUser = localStorage.getItem("currentUser")
            if(!savedUser){
                window.location.href = "./login.html"//tp到登陆页
                return
            }
            this.currentUser = JSON.parse(savedUser)
            this.getList()//自动调用 getList()→ Axios 请求后端→ 后端任务显示到页面
        },
        // 定义方法
        methods: {
            //前端查后端数据
            async getList(){
                const response = await axios.get(
                    "http://localhost:3000/api/todos",
                    {
                        params: {
                            userId: this.currentUser.id
                        }
                    }
                )//像后端请求任务
                this.todos = response.data
            },
            async addTodo() {
                // this.newTodo 对应 v-model="newTodo"
                const text = this.newTodo.trim() // trim 用于去掉前后空格

                if (text === "") {
                    this.errorMessage = "任务不能为空"
                    return
                }
                this.errorMessage = ""

                // this.todos.push({
                //     id: Date.now(), // 用时间戳作为任务唯一编号，供 :key 使用
                //     text: text,
                //     done: false
                // })
                try{
                    await axios.post(
                        "http://localhost:3000/api/todos",
                        { 
                            text: text ,
                            userId: this.currentUser.id
                        }
                        )//POST 到 Node.js 后端→ 后端读取 text→ INSERT 写入 todo.db

                    this.newTodo = ""//清空输入框
                    await this.getList()//再调用
                    }catch(error) {
                        this.errorMessage = "添加失败，请检查后端服务是否启动"
                    }
            },

            async deleteTodo(id) { // 对应 @click="deleteTodo(todo.id)"
                // this.todos = this.todos.filter(todo => todo.id !== id)
                await axios.post(
                    "http://localhost:3000/api/todos/delete",
                    { id: id }
                )
                await this.getList()
            },
            async updateTodo(todo){
                await axios.post(
                    "http://localhost:3000/api/todos/update",
                    {
                        id: todo.id,
                        done: todo.done
                    }
                )
                await this.getList()
            },
            async editTodo(todo) {
                const text = prompt("请输入新的任务内容", todo.text)
                if (text === null || text.trim() === "") return

                await axios.post(
                    "http://localhost:3000/api/todos/edit-text",
                    {
                        id: todo.id,
                        text: text.trim()
                    }
                )
                await this.getList()
            },
            logout(){
                localStorage.removeItem("currentUser")
                window.location.href = "./login.html"//跳转到同文件夹中的登录页
            }
        }
    }).mount("#app")
  