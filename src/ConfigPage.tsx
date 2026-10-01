interface ConfigPageProps {
  apiUrl: string;
}

export function ConfigPage({ apiUrl }: ConfigPageProps) {
  return (
    <main className="config-page">
      <div className="config-card">
        <p className="eyebrow">Ulabase Starter</p>
        <h1>Connect your service</h1>

        <p>
          Sign-up, login, email verification, password reset, invitations and team
          management are already built and wired up. One step to go: point the app
          at a Ulabase service.
        </p>

        <div className="config-status">
          {apiUrl ? (
            <p>
              <code>apiUrl</code> is set to <code>{apiUrl}</code>, which isn't a
              Ulabase service — it must be an <code>https://</code> address.
            </p>
          ) : (
            <p><code>apiUrl</code> isn't set yet.</p>
          )}
        </div>

        <ol className="config-steps">
          <li>
            <div>
              <strong>Create a free service</strong>
              <p>
                At{' '}
                <a href="https://ulabase.com" target="_blank" rel="noopener">ulabase.com</a>
                {' '}— it takes less than a minute. Skip this if you already have one.
              </p>
            </div>
          </li>
          <li>
            <div>
              <strong>Copy its URL into your environment file</strong>
              <p>
                Edit <code>src/environments/environment.ts</code> and set{' '}
                <code>apiUrl</code> to your Ulabase service URL.
              </p>
            </div>
          </li>
          <li>
            <div>
              <strong>Reload</strong>
              <p>This screen is replaced by the sign-in page, and you're in.</p>
            </div>
          </li>
        </ol>
      </div>
    </main>
  );
}
