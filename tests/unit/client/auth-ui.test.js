import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function createHarness(values = {}) {
  const elements = new Map();
  const makeElement = (id) => {
    const listeners = new Map();
    const element = {
      id,
      value: values[id] || '',
      textContent: '',
      listeners,
      classList: { add: vi.fn(), remove: vi.fn() },
      addEventListener: vi.fn((event, handler) => listeners.set(event, handler))
    };
    elements.set(id, element);
    return element;
  };

  [
    'show-register', 'show-login', 'login-form', 'register-form',
    'login-username', 'login-password', 'register-username',
    'register-password', 'register-confirm', 'auth-error'
  ].forEach(makeElement);

  const network = { login: vi.fn(), register: vi.fn() };
  const context = vm.createContext({
    document: { getElementById: id => elements.get(id) },
    Network: network,
    Logger: { log: vi.fn() }
  });
  context.globalThis = context;
  const filename = path.join(projectRoot, 'client/js/ui/auth.js');
  vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });

  return {
    authUI: vm.runInContext('AuthUI', context),
    elements,
    network
  };
}

describe('authentication form UX', () => {
  it('submits login through the semantic form without navigating', () => {
    const { authUI, elements, network } = createHarness({
      'login-username': ' pilot ',
      'login-password': 'secret'
    });
    authUI.init();
    const preventDefault = vi.fn();

    elements.get('login-form').listeners.get('submit')({ preventDefault });

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(network.login).toHaveBeenCalledWith('pilot', 'secret');
  });

  it('submits valid registration and keeps mismatch feedback accessible', () => {
    const { authUI, elements, network } = createHarness({
      'register-username': 'new_pilot',
      'register-password': 'secret',
      'register-confirm': 'secret'
    });
    authUI.init();

    elements.get('register-form').listeners.get('submit')({ preventDefault: vi.fn() });
    expect(network.register).toHaveBeenCalledWith('new_pilot', 'secret');

    elements.get('register-confirm').value = 'different';
    elements.get('register-form').listeners.get('submit')({ preventDefault: vi.fn() });
    expect(elements.get('auth-error').textContent).toBe('Passwords do not match');
    expect(network.register).toHaveBeenCalledTimes(1);
  });
});
