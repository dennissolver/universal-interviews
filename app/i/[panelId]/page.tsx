async function startInterview() {
  setStatus('connecting');

  if (intervieweeId) {
    await fetch('/api/invites/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intervieweeId, status: 'started' }),
    });
  }

  const container = document.getElementById('widget-container');
  if (!container || !panel?.elevenlabs_agent_id) {
    setError('Interview agent not available');
    setStatus('ready');
    return;
  }

  const mountWidget = () => {
    // Prevent double-mount
    container.innerHTML = '';

    const el = document.createElement('elevenlabs-convai');
    el.setAttribute('agent-id', panel.elevenlabs_agent_id);

    container.appendChild(el);
    setStatus('active');
  };

  // Load widget script only once
  if (!document.querySelector('script[src*="convai-widget"]')) {
    const script = document.createElement('script');
    script.src = 'https://elevenlabs.io/convai-widget/index.js';
    script.async = true;

    script.onload = mountWidget;

    script.onerror = () => {
      setError('Failed to load interview widget');
      setStatus('ready');
    };

    document.body.appendChild(script);
  } else {
    mountWidget();
  }
}
