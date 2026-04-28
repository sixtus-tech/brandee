/**
 * MockDashboard — fake Brandee platform main content.
 * Just enough product-feeling chrome that the avatar feels embedded
 * in a real workspace, not floating in a demo.
 */
export default function MockDashboard({ onCelebrate }) {
  return (
    <div className="dashboard">
      <header className="dash-header">
        <div>
          <div className="dash-eyebrow">Brand Hub</div>
          <h1 className="dash-title">
            <span className="serif">Good afternoon.</span>
          </h1>
          <p className="dash-sub">
            Here's what your brand's been up to.
          </p>
        </div>
        <button className="dash-cta" onClick={onCelebrate}>
          + New Campaign
        </button>
      </header>

      <div className="kpi-grid">
        {[
          { label: 'Brand mentions', value: '1,284', delta: '+12%' },
          { label: 'Active campaigns', value: '7', delta: '+2' },
          { label: 'Content drafts', value: '23', delta: 'new' },
          { label: 'Sentiment', value: '94%', delta: '↑' },
        ].map((k) => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value">{k.value}</div>
            <div className="kpi-delta">{k.delta}</div>
          </div>
        ))}
      </div>

      <div className="dash-cols">
        <section className="card">
          <h2 className="card-title">Recent activity</h2>
          <ul className="activity">
            <li>
              <span className="dot d-green" />
              <span>Tagline draft v3 approved</span>
              <time>2h</time>
            </li>
            <li>
              <span className="dot d-amber" />
              <span>Spring campaign mood board updated</span>
              <time>yesterday</time>
            </li>
            <li>
              <span className="dot d-blue" />
              <span>Design system tokens synced</span>
              <time>2d</time>
            </li>
            <li>
              <span className="dot d-green" />
              <span>3 social posts scheduled</span>
              <time>3d</time>
            </li>
          </ul>
        </section>

        <section className="card">
          <h2 className="card-title">Brand pulse</h2>
          <div className="pulse-bars">
            {[68, 82, 71, 90, 76, 88, 94].map((h, i) => (
              <div key={i} className="pulse-bar" style={{ height: `${h}%` }} />
            ))}
          </div>
          <div className="pulse-labels">
            <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
          </div>
        </section>
      </div>

      <section className="card hint-card">
        <div className="hint-row">
          <div className="hint-icon">💡</div>
          <div>
            <div className="hint-title">Try clicking Brandee</div>
            <div className="hint-text">
              She lives in the sidebar. Click her to wake her up, or try the chat button to talk.
              She also gets bored — leave the tab idle for a bit and watch what she does.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
