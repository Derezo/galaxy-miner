// Galaxy Miner - Audio Context Manager
// Handles Web Audio API context creation and lifecycle

const AudioContextManager = (function() {
  let context = null;
  let isResumed = false;
  let resumeListenerAttached = false;

  function init() {
    try {
      // Create AudioContext with webkit prefix fallback
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();

      // Check initial state
      if (context.state === 'running') {
        isResumed = true;
        Logger.log('AudioContext created and running');
      } else {
        Logger.log('AudioContext created but suspended, waiting for user interaction');
        attachResumeListener();
      }

      return true;
    } catch (error) {
      console.error('Failed to create AudioContext:', error);
      return false;
    }
  }

  function attachResumeListener() {
    if (resumeListenerAttached) return;

    const resumeHandler = () => {
      resume();

      // Remove listeners after first interaction
      if (isResumed) {
        document.removeEventListener('click', resumeHandler);
        document.removeEventListener('keydown', resumeHandler);
        document.removeEventListener('touchstart', resumeHandler);
        resumeListenerAttached = false;
      }
    };

    // Listen for various user interaction events
    document.addEventListener('click', resumeHandler);
    document.addEventListener('keydown', resumeHandler);
    document.addEventListener('touchstart', resumeHandler);

    resumeListenerAttached = true;
  }

  function resume() {
    if (!context || isResumed) return;

    if (context.state === 'suspended') {
      context.resume().then(() => {
        isResumed = true;
        Logger.log('AudioContext resumed');
      }).catch(error => {
        console.error('Failed to resume AudioContext:', error);
      });
    } else if (context.state === 'running') {
      isResumed = true;
    }
  }

  function getContext() {
    return context;
  }

  function isReady() {
    return context !== null && isResumed;
  }

  function getState() {
    return context ? context.state : 'closed';
  }

  return {
    init,
    getContext,
    resume,
    isReady,
    getState
  };
})();
