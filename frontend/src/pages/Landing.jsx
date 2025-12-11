import { Link } from 'react-router-dom';
import { useEffect, useRef } from 'react';

const Landing = () => {
  const observerRef = useRef(null);

  useEffect(() => {
    // Intersection Observer for scroll animations
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    // Observe all animatable elements
    document.querySelectorAll('.animate-on-scroll').forEach((el) => {
      observerRef.current.observe(el);
    });

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return (
    <div className="landing-page">
      {/* Animated Background */}
      <div className="landing-bg-shapes">
        <div className="landing-shape landing-shape-1"></div>
        <div className="landing-shape landing-shape-2"></div>
        <div className="landing-shape landing-shape-3"></div>
        <div className="landing-shape landing-shape-4"></div>
        <div className="landing-shape landing-shape-5"></div>
      </div>

      {/* Navigation */}
      <nav className="landing-nav">
        <div className="landing-nav-content">
          <Link to="/" className="landing-logo">
            <img src="/aitu-logo__2.png" alt="AITU" className="landing-logo-img" />
            <span className="landing-logo-text">Alumni Network</span>
          </Link>
          <div className="landing-nav-links">
            <Link to="/login" className="landing-nav-link">Sign in</Link>
            <Link to="/register" className="landing-btn-primary">Join now</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="landing-hero-content">
          <div className="landing-hero-text">
            <h1 className="landing-hero-title">
              <span className="animate-text-line">Connect with AITU's</span>
              <span className="animate-text-line animate-text-line-2">brightest minds</span>
            </h1>
            <p className="landing-hero-desc animate-fade-up animate-delay-2">
              Join the official alumni network of Astana IT University. 
              Build meaningful connections, find mentors, and discover 
              career opportunities with fellow students and graduates.
            </p>
            <div className="landing-hero-actions animate-fade-up animate-delay-3">
              <Link to="/register" className="landing-btn-large landing-btn-animated">
                <span>Get started — it's free</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </Link>
              <Link to="/login" className="landing-btn-outline">Sign in</Link>
            </div>
          </div>
          <div className="landing-hero-visual animate-fade-left animate-delay-2">
            <div className="landing-hero-card landing-card-float">
              <div className="landing-card-glow"></div>
              <div className="landing-card-header">
                <div className="landing-card-avatar landing-pulse"></div>
                <div className="landing-card-info">
                  <div className="landing-card-name"></div>
                  <div className="landing-card-title"></div>
                </div>
              </div>
              <div className="landing-card-stats">
                <div className="landing-stat">
                  <span className="landing-stat-number landing-counter" data-target="500">500+</span>
                  <span className="landing-stat-label">Alumni</span>
                </div>
                <div className="landing-stat">
                  <span className="landing-stat-number landing-counter" data-target="200">200+</span>
                  <span className="landing-stat-label">Mentors</span>
                </div>
                <div className="landing-stat">
                  <span className="landing-stat-number landing-counter" data-target="50">50+</span>
                  <span className="landing-stat-label">Companies</span>
                </div>
              </div>
            </div>
            {/* Floating badges */}
            <div className="landing-floating-badge landing-badge-1">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <span>Verified Alumni</span>
            </div>
            <div className="landing-floating-badge landing-badge-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
              </svg>
              <span>New Jobs Daily</span>
            </div>
          </div>
        </div>
        
        {/* Scroll indicator */}
        <div className="landing-scroll-indicator">
          <div className="landing-scroll-mouse">
            <div className="landing-scroll-wheel"></div>
          </div>
          <span>Scroll to explore</span>
        </div>
      </section>

      {/* Features Section */}
      <section className="landing-features">
        <div className="landing-features-content">
          <h2 className="animate-on-scroll">Everything you need to grow your network</h2>
          <div className="landing-features-grid">
            <div className="landing-feature-card animate-on-scroll" style={{ transitionDelay: '0ms' }}>
              <div className="landing-feature-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <h3>Connect</h3>
              <p>Find and connect with fellow students and alumni from AITU across industries and locations.</p>
              <div className="landing-feature-hover-line"></div>
            </div>
            <div className="landing-feature-card animate-on-scroll" style={{ transitionDelay: '100ms' }}>
              <div className="landing-feature-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </div>
              <h3>Learn</h3>
              <p>Get mentorship from experienced alumni who can guide your career and personal development.</p>
              <div className="landing-feature-hover-line"></div>
            </div>
            <div className="landing-feature-card animate-on-scroll" style={{ transitionDelay: '200ms' }}>
              <div className="landing-feature-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                </svg>
              </div>
              <h3>Grow</h3>
              <p>Discover job opportunities, internships, and career resources shared by the community.</p>
              <div className="landing-feature-hover-line"></div>
            </div>
            <div className="landing-feature-card animate-on-scroll" style={{ transitionDelay: '300ms' }}>
              <div className="landing-feature-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <h3>Engage</h3>
              <p>Attend exclusive events, workshops, and networking sessions organized by the community.</p>
              <div className="landing-feature-hover-line"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="landing-stats">
        <div className="landing-stats-content">
          <div className="landing-stats-grid">
            <div className="landing-stats-item animate-on-scroll" style={{ transitionDelay: '0ms' }}>
              <span className="landing-stats-number">1,000+</span>
              <span className="landing-stats-label">Members</span>
            </div>
            <div className="landing-stats-item animate-on-scroll" style={{ transitionDelay: '100ms' }}>
              <span className="landing-stats-number">500+</span>
              <span className="landing-stats-label">Connections Made</span>
            </div>
            <div className="landing-stats-item animate-on-scroll" style={{ transitionDelay: '200ms' }}>
              <span className="landing-stats-number">100+</span>
              <span className="landing-stats-label">Job Placements</span>
            </div>
            <div className="landing-stats-item animate-on-scroll" style={{ transitionDelay: '300ms' }}>
              <span className="landing-stats-number">50+</span>
              <span className="landing-stats-label">Events Hosted</span>
            </div>
          </div>
        </div>
      </section>

      {/* Marquee Section */}
      <section className="landing-marquee">
        <div className="landing-marquee-track">
          <div className="landing-marquee-content">
            <span>AITU Alumni Network</span>
            <span className="landing-marquee-dot">●</span>
            <span>Connect • Learn • Grow</span>
            <span className="landing-marquee-dot">●</span>
            <span>500+ Alumni Strong</span>
            <span className="landing-marquee-dot">●</span>
            <span>AITU Alumni Network</span>
            <span className="landing-marquee-dot">●</span>
            <span>Connect • Learn • Grow</span>
            <span className="landing-marquee-dot">●</span>
            <span>500+ Alumni Strong</span>
            <span className="landing-marquee-dot">●</span>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="landing-cta">
        <div className="landing-cta-content animate-on-scroll">
          <h2>Ready to join the network?</h2>
          <p>Start building meaningful connections with AITU's community today.</p>
          <Link to="/register" className="landing-btn-large landing-btn-white landing-btn-animated">
            <span>Create your free account</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-content">
          <div className="landing-footer-brand">
            <img src="/aitu-logo__2.png" alt="AITU" className="landing-footer-logo" />
            <span>Alumni Network</span>
          </div>
          <div className="landing-footer-links">
            <Link to="/login">Sign in</Link>
            <Link to="/register">Register</Link>
          </div>
          <p className="landing-footer-copy">© 2025 AITU Alumni Network. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
