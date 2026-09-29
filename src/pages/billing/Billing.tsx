import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@ulabase/kit-react';
import type { TeamMembership } from '@ulabase/kit-react';
import './Billing.css';

export default function Billing() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);

  useEffect(() => {
    auth.loadTeams().then(
      () => setLoading(false),
      () => setLoading(false)
    );
  }, [auth.loadTeams]);

  const openTeam = useCallback(async (team: TeamMembership) => {
    if (!team.active) {
      setSwitchingTo(team.id.$oid);
      await auth.switchTeam(team.id);
      setSwitchingTo(null);
    }
    navigate(`/billing/${team.id.$oid}`);
  }, [auth, navigate]);

  return (
    <section className="card">
      <div className="card-header">
        <h2>Your billing accounts</h2>
        <Link to="/billing/new" className="btn-secondary">+ New billing account</Link>
      </div>

      {/* The server calls this a team, and the kit's API says `teams` all the way
          down. In a shop nobody has a team — they have an account things are
          charged to, and sometimes more than one: their own, and the company's.
          Renaming it only here, where a customer reads it, keeps the kit's
          vocabulary intact and the customer's plain. */}
      <p className="muted billing-intro">
        Purchases are charged to a billing account. Invite people to one and you
        share it — orders they place are charged there, and everyone on the
        account can see them. Most people need only the one they already have.
      </p>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : auth.teams.length === 0 ? (
        <p className="muted">You have no billing account yet.</p>
      ) : (
        <ul className="team-list">
          {auth.teams.map(team => (
            <li key={team.id.$oid}>
              <div className={`team-row${team.active ? ' active' : ''}`}>
                <Link
                  to={`/billing/${team.id.$oid}`}
                  className="team-link"
                  onClick={e => { e.preventDefault(); openTeam(team); }}
                >
                  <span className="team-name">{team.name || team.id.$oid}</span>
                  {team.description && (
                    <span className="team-desc">{team.description}</span>
                  )}
                  <span className="team-role">{team.role}</span>
                </Link>
                {team.active ? (
                  <span className="team-badge">current</span>
                ) : switchingTo === team.id.$oid ? (
                  <span className="muted">Switching…</span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
