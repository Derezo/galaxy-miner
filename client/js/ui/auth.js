// Galaxy Miner - Auth UI

const AuthUI = {
  init() {
    // Form switching
    document.getElementById('show-register').addEventListener('click', (e) => {
      e.preventDefault();
      this.showRegister();
    });

    document.getElementById('show-login').addEventListener('click', (e) => {
      e.preventDefault();
      this.showLogin();
    });

    // Semantic form submission supports keyboard, password managers, and
    // mobile action keys without allowing a browser navigation.
    document.getElementById('login-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    document.getElementById('register-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleRegister();
    });

    Logger.log('Auth UI initialized');
  },

  showLogin() {
    document.getElementById('login-form').classList.add('active');
    document.getElementById('register-form').classList.remove('active');
    this.clearError();
  },

  showRegister() {
    document.getElementById('login-form').classList.remove('active');
    document.getElementById('register-form').classList.add('active');
    this.clearError();
  },

  handleLogin() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    if (!username || !password) {
      this.showError('Please enter username and password');
      return;
    }

    Network.login(username, password);
  },

  handleRegister() {
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-confirm').value;

    if (!username || !password) {
      this.showError('Please enter username and password');
      return;
    }

    if (username.length < 3 || username.length > 20) {
      this.showError('Username must be 3-20 characters');
      return;
    }

    if (password.length < 4) {
      this.showError('Password must be at least 4 characters');
      return;
    }

    if (password !== confirm) {
      this.showError('Passwords do not match');
      return;
    }

    Network.register(username, password);
  },

  showError(message) {
    document.getElementById('auth-error').textContent = message;
  },

  clearError() {
    document.getElementById('auth-error').textContent = '';
  }
};
