import { ensureStyles } from './styles.ts';

export interface AuthScreenDeps {
  onSignIn: (email: string, password: string) => void;
  onSignUp: (email: string, password: string) => void;
}

export interface AuthScreen {
  el: HTMLElement;
  showError: (msg: string) => void;
  hide: () => void;
}

/**
 * Full-screen sign-in form: email + password inputs, Sign in + Sign up
 * buttons, an error line. Pure intent-out DOM — it only reports the entered
 * credentials via the callbacks; S13 wires it to the AuthGateway.
 */
export function createAuthScreen(deps: AuthScreenDeps): AuthScreen {
  ensureStyles();
  const el = document.createElement('section');
  el.className = 'auth-screen lg-modal-backdrop';
  el.dataset['testid'] = 'auth-screen';
  el.style.background = '#0b0f14'; // opaque: nothing behind it should show

  const card = document.createElement('div');
  card.className = 'lg-modal';
  card.style.display = 'flex';
  card.style.flexDirection = 'column';
  card.style.alignItems = 'center';
  card.style.gap = '0.75rem';
  el.appendChild(card);

  const title = document.createElement('h1');
  title.textContent = 'Life Game';
  title.style.margin = '0 0 1rem';
  card.appendChild(title);

  const email = document.createElement('input');
  email.type = 'email';
  email.placeholder = 'Email';
  email.autocomplete = 'email';
  email.className = 'auth-email lg-input';
  email.dataset['testid'] = 'auth-email';
  card.appendChild(email);

  const password = document.createElement('input');
  password.type = 'password';
  password.placeholder = 'Password';
  password.autocomplete = 'current-password';
  password.className = 'auth-password lg-input';
  password.dataset['testid'] = 'auth-password';
  card.appendChild(password);

  const buttons = document.createElement('div');
  buttons.style.display = 'flex';
  buttons.style.gap = '0.5rem';
  card.appendChild(buttons);

  const signIn = document.createElement('button');
  signIn.type = 'button';
  signIn.textContent = 'Sign in';
  signIn.className = 'auth-signin lg-btn lg-btn--primary';
  signIn.dataset['testid'] = 'auth-signin';
  buttons.appendChild(signIn);

  const signUp = document.createElement('button');
  signUp.type = 'button';
  signUp.textContent = 'Sign up';
  signUp.className = 'auth-signup lg-btn lg-btn--ghost';
  signUp.dataset['testid'] = 'auth-signup';
  buttons.appendChild(signUp);

  const error = document.createElement('p');
  error.className = 'auth-error';
  error.dataset['testid'] = 'auth-error';
  error.style.color = 'var(--lg-danger)';
  error.style.minHeight = '1.25rem';
  error.style.margin = '0';
  error.textContent = '';
  card.appendChild(error);

  signIn.addEventListener('click', () => {
    deps.onSignIn(email.value, password.value);
  });
  signUp.addEventListener('click', () => {
    deps.onSignUp(email.value, password.value);
  });

  return {
    el,
    showError(msg) {
      error.textContent = msg;
    },
    hide() {
      el.style.display = 'none';
    },
  };
}
