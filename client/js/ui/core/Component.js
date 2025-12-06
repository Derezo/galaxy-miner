/**
 * Lightweight Component Factory
 * Creates reusable UI components with state management and lifecycle hooks.
 */

/**
 * Create a new component instance
 * @param {Object} config - Component configuration
 * @param {Function} config.render - Returns DOM element(s) based on state
 * @param {Object} config.initialState - Initial component state
 * @param {Function} config.onMount - Called after component is mounted to DOM
 * @param {Function} config.onUpdate - Called after state updates
 * @param {Function} config.onDestroy - Called before component is destroyed
 * @returns {Object} Component instance
 */
function createComponent(config) {
  const {
    render,
    initialState = {},
    onMount = null,
    onUpdate = null,
    onDestroy = null
  } = config;

  const component = {
    el: null,
    state: { ...initialState },
    _listeners: [],
    _mounted: false,

    /**
     * Render the component and return its DOM element
     * @returns {HTMLElement}
     */
    render() {
      const newEl = render(this.state, this);

      if (this.el && this.el.parentNode) {
        this.el.parentNode.replaceChild(newEl, this.el);
      }

      this.el = newEl;
      return this.el;
    },

    /**
     * Mount the component to a parent element
     * @param {HTMLElement} parent - Parent element to mount to
     * @param {string} position - 'append', 'prepend', or 'replace'
     */
    mount(parent, position = 'append') {
      this.render();

      if (position === 'prepend') {
        parent.insertBefore(this.el, parent.firstChild);
      } else if (position === 'replace') {
        parent.innerHTML = '';
        parent.appendChild(this.el);
      } else {
        parent.appendChild(this.el);
      }

      this._mounted = true;

      if (onMount) {
        onMount.call(this, this.el);
      }
    },

    /**
     * Update component state and re-render
     * @param {Object} newState - Partial state to merge
     */
    update(newState) {
      const prevState = { ...this.state };
      this.state = { ...this.state, ...newState };

      if (this._mounted) {
        this.render();

        if (onUpdate) {
          onUpdate.call(this, prevState, this.state);
        }
      }
    },

    /**
     * Set state without re-rendering (useful for batched updates)
     * @param {Object} newState - Partial state to merge
     */
    setState(newState) {
      this.state = { ...this.state, ...newState };
    },

    /**
     * Add event listener with automatic cleanup tracking
     * @param {HTMLElement} element - Element to attach listener to
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     * @param {Object} options - Event listener options
     */
    on(element, event, handler, options = {}) {
      const boundHandler = handler.bind(this);
      element.addEventListener(event, boundHandler, options);
      this._listeners.push({ element, event, handler: boundHandler, options });
    },

    /**
     * Query element within this component
     * @param {string} selector - CSS selector
     * @returns {HTMLElement|null}
     */
    $(selector) {
      return this.el ? this.el.querySelector(selector) : null;
    },

    /**
     * Query all elements within this component
     * @param {string} selector - CSS selector
     * @returns {NodeList}
     */
    $$(selector) {
      return this.el ? this.el.querySelectorAll(selector) : [];
    },

    /**
     * Destroy the component and clean up
     */
    destroy() {
      if (onDestroy) {
        onDestroy.call(this);
      }

      // Remove all tracked event listeners
      this._listeners.forEach(({ element, event, handler, options }) => {
        element.removeEventListener(event, handler, options);
      });
      this._listeners = [];

      // Remove from DOM
      if (this.el && this.el.parentNode) {
        this.el.parentNode.removeChild(this.el);
      }

      this.el = null;
      this._mounted = false;
    }
  };

  return component;
}

/**
 * Helper to create DOM elements with attributes and children
 * @param {string} tag - HTML tag name
 * @param {Object} attrs - Attributes to set
 * @param {Array|string|HTMLElement} children - Child elements or text
 * @returns {HTMLElement}
 */
function createElement(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);

  // Set attributes
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'className') {
      el.className = value;
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(el.style, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      const event = key.slice(2).toLowerCase();
      el.addEventListener(event, value);
    } else if (key === 'dataset' && typeof value === 'object') {
      Object.assign(el.dataset, value);
    } else {
      el.setAttribute(key, value);
    }
  }

  // Add children
  const childArray = Array.isArray(children) ? children : [children];
  childArray.forEach(child => {
    if (child === null || child === undefined) return;
    if (typeof child === 'string' || typeof child === 'number') {
      el.appendChild(document.createTextNode(String(child)));
    } else if (child instanceof Node) {
      el.appendChild(child);
    }
  });

  return el;
}

/**
 * Shorthand for createElement
 */
const h = createElement;

// Export for browser
if (typeof window !== 'undefined') {
  window.createComponent = createComponent;
  window.createElement = createElement;
  window.h = h;
}
