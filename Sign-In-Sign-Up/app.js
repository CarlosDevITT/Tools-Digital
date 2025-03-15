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

// Verificar se o usuário já está logado
const currentUser = localStorage.getItem('currentUser');
if (currentUser) {
  window.location.href = "https://tools-digital.vercel.app/"; // Redireciona para a página principal
}

// Função para validar login
function validateLogin(event) {
  event.preventDefault();

  const username = document.querySelector('.sign-in-form input[type="text"]').value.trim();
  const password = document.querySelector('.sign-in-form input[type="password"]').value;

  const user = users.find(user => user.username === username && user.password === password);

  if (user) {
      // Salva o usuário logado no localStorage
      localStorage.setItem('currentUser', JSON.stringify(user));
      window.location.href = "https://tools-digital.vercel.app/"; // Redireciona para a página principal
  } else {
      showFeedback('login-feedback', 'Usuário ou senha incorretos.');
  }
}

// Função para cadastrar usuário
function registerUser(event) {
  event.preventDefault();

  const username = document.querySelector('.sign-up-form input[type="text"]').value.trim();
  const password = document.querySelector('.sign-up-form input[type="password"]').value;

  if (!username || !password) {
      showFeedback('register-feedback', 'Por favor, preencha todos os campos.');
      return;
  }

  if (password.length < 6) {
      showFeedback('register-feedback', 'A senha deve ter pelo menos 6 caracteres.');
      return;
  }

  const userExists = users.some(user => user.username === username);
  if (userExists) {
      showFeedback('register-feedback', 'Nome de usuário já em uso.');
      return;
  }

  // Adiciona o novo usuário ao array de usuários
  users.push({ username, password });
  localStorage.setItem('users', JSON.stringify(users));
  showFeedback('register-feedback', 'Usuário cadastrado com sucesso!', 'green');

  // Redireciona para a página principal após 2 segundos
  setTimeout(() => {
      window.location.href = "https://tools-digital.vercel.app/";
  }, 2000);
}

// Função para logout
function logout() {
  localStorage.removeItem('currentUser');
  window.location.href = "login.html"; // Redireciona para a página de login
}

// Função para exibir feedback na interface
function showFeedback(elementId, message, color = 'red') {
  const feedbackElement = document.getElementById(elementId);
  feedbackElement.textContent = message;
  feedbackElement.style.color = color;
  feedbackElement.classList.remove('hidden');

  // Oculta o feedback após 3 segundos
  setTimeout(() => {
      feedbackElement.classList.add('hidden');
  }, 3000);
}

// Adiciona o evento de submit ao formulário de login
document.querySelector('.sign-in-form').addEventListener('submit', validateLogin);

// Adiciona o evento de submit ao formulário de cadastro
document.querySelector('.sign-up-form').addEventListener('submit', registerUser);

// Adiciona o evento de logout ao botão de logout
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', logout);
}

// Alternar entre as telas de login e cadastro
const sign_in_btn = document.querySelector("#sign-in-btn");
const sign_up_btn = document.querySelector("#sign-up-btn");
const container = document.querySelector(".container");

if (sign_up_btn && sign_in_btn && container) {
  sign_up_btn.addEventListener("click", () => {
      container.classList.add("sign-up-mode");
  });

  sign_in_btn.addEventListener("click", () => {
      container.classList.remove("sign-up-mode");
  });
}