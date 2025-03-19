// Usuários pré-definidos
let users = [
  { username: "user1", password: "password1" },
  { username: "user2", password: "password2" }
];

// Carregar usuários do localStorage
const storedUsers = localStorage.getItem('users');
if (storedUsers) {
  users.push(...JSON.parse(storedUsers));
}

// Função para validar login
function validateLogin(event) {
  event.preventDefault();

  const username = document.querySelector('.sign-in-form input[type="text"]').value.trim();
  const password = document.querySelector('.sign-in-form input[type="password"]').value;

  const user = users.find(user => user.username === username && user.password === password);

  if (user) {
      alert("Login bem-sucedido!");
      window.location.href = "https://tools-digital.vercel.app/";
  } else {
      alert("Usuário ou senha incorretos.");
  }
}

// Função para cadastrar usuário
function registerUser(event) {
  event.preventDefault();

  const username = document.querySelector('.sign-up-form input[type="text"]').value.trim();
  const password = document.querySelector('.sign-up-form input[type="password"]').value;

  if (!username || !password) {
      alert("Por favor, preencha todos os campos.");
      return;
  }

  const userExists = users.some(user => user.username === username);
  if (userExists) {
      alert("Nome de usuário já em uso.");
      return;
  }

  users.push({ username, password });
  localStorage.setItem('users', JSON.stringify(users));
  alert("Usuário cadastrado com sucesso!");
  document.querySelector('.sign-up-form').reset();
}

// Adiciona o evento de submit ao formulário de login
document.querySelector('.sign-in-form').addEventListener('submit', validateLogin);

// Adiciona o evento de submit ao formulário de cadastro
document.querySelector('.sign-up-form').addEventListener('submit', registerUser);

// Alternar entre as telas de login e cadastro
const sign_in_btn = document.querySelector("#sign-in-btn");
const sign_up_btn = document.querySelector("#sign-up-btn");
const container = document.querySelector(".container");

sign_up_btn.addEventListener("click", () => {
  container.classList.add("sign-up-mode");
});

sign_in_btn.addEventListener("click", () => {
  container.classList.remove("sign-up-mode");
});