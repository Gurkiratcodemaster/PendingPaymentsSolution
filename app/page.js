"use client";

import React, { useState, useEffect, useTransition } from "react";
import { 
  Search, 
  Lock, 
  Unlock, 
  CheckCircle, 
  AlertTriangle, 
  Calendar, 
  QrCode, 
  RefreshCw, 
  Phone, 
  ArrowLeft, 
  User,
  CreditCard
} from "lucide-react";
import { fetchCustomersPublic, verifyCustomer } from "./actions";

export default function Home() {
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCust, setSelectedCust] = useState(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [mobileNumber, setMobileNumber] = useState("");
  const [dob, setDob] = useState("");
  
  // States for verified customer details
  const [isVerified, setIsVerified] = useState(false);
  const [verifiedCust, setVerifiedCust] = useState(null);
  const [verifiedSummary, setVerifiedSummary] = useState(null);

  const [isPending, startTransition] = useTransition();
  const [loadingList, setLoadingList] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [listError, setListError] = useState("");
  const [isConfigMissing, setIsConfigMissing] = useState(false);

  // Load customer list on start
  useEffect(() => {
    async function loadCustomers() {
      setLoadingList(true);
      const res = await fetchCustomersPublic();
      if (res.success) {
        setCustomers(res.data);
      } else {
        if (res.isConfigMissing) {
          setIsConfigMissing(true);
        }
        setListError(res.error);
      }
      setLoadingList(false);
    }
    loadCustomers();
  }, []);

  // Filter customers by name
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Trigger verification modal
  const handleSelectCustomer = (cust) => {
    setSelectedCust(cust);
    setMobileNumber("");
    setDob("");
    setErrorMsg("");
    setShowVerifyModal(true);
  };

  // Submit verification
  const handleVerifySubmit = (e) => {
    e.preventDefault();
    if (!mobileNumber || !dob) {
      setErrorMsg("Please fill out all verification fields.");
      return;
    }

    setErrorMsg("");
    startTransition(async () => {
      const res = await verifyCustomer(selectedCust.id, mobileNumber, dob);
      if (res.success) {
        setVerifiedCust(res.customer);
        setVerifiedSummary(res.summary);
        setIsVerified(true);
        setShowVerifyModal(false);
      } else {
        setErrorMsg(res.error);
      }
    });
  };

  // Log out/Lock session
  const handleLockSession = () => {
    setIsVerified(false);
    setVerifiedCust(null);
    setVerifiedSummary(null);
    setSelectedCust(null);
  };

  // Format dates elegantly
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const formatShortDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };

  // UPI payment QR creation URL
  const getUpiQrUrl = () => {
    if (!verifiedSummary) return "";
    const upiId = process.env.NEXT_PUBLIC_UPI_ID || "printshop@upi";
    const merchantName = process.env.NEXT_PUBLIC_MERCHANT_NAME || "Quantum Printing";
    const amount = verifiedSummary.totalPendingPayment;
    
    // Construct UPI Deep Link
    // upi://pay?pa=recipient@upi&pn=RecipientName&am=100.00&cu=INR
    const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(merchantName)}&am=${amount.toFixed(2)}&cu=INR&tn=Pending%20Payment`;
    
    // QR Server API url
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiLink)}`;
  };

  return (
    <>
      {/* Navbar */}
      <header className="navbar">
        <div className="nav-logo">
          <CreditCard size={20} />
          <span>QUANTUM.PAY</span>
        </div>
        <div className="nav-links">
          <a href="/admin" className="btn-nav btn-nav-outline">
            Admin Log In
          </a>
        </div>
      </header>

      <main className="main-container">
        {isConfigMissing ? (
          <div className="card" style={{ maxWidth: "600px", margin: "2rem auto", padding: "2.5rem 2rem" }}>
            <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
              <AlertTriangle size={48} style={{ color: "var(--warning)", marginBottom: "0.5rem" }} />
              <h2 style={{ fontSize: "1.75rem", fontFamily: "var(--font-mono)" }}>Configuration Required</h2>
            </div>
            
            <p className="text-muted" style={{ lineHeight: "1.6", marginBottom: "1.5rem" }}>
              The application is unable to connect to the database because the API credentials are still set to placeholders in your <code>.env.local</code> file.
            </p>

            <div className="alert alert-info" style={{ textAlign: "left", display: "block" }}>
              <h4 style={{ fontWeight: 600, marginBottom: "0.5rem" }}>How to fix this:</h4>
              <ol style={{ paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.85rem" }}>
                <li>Create a project on <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline", color: "inherit" }}>Supabase</a>.</li>
                <li>Go to the SQL Editor in Supabase, copy the schema from <a href="file:///c:/Users/Gurkirat%20singh/Downloads/myproject/supabase_help.md" style={{ textDecoration: "underline", color: "inherit" }}>supabase_help.md</a>, and run it.</li>
                <li>Go to Project Settings → API in your Supabase dashboard and get your <strong>Project URL</strong>, <strong>anon key</strong>, and <strong>service_role key</strong>.</li>
                <li>Open <a href="file:///c:/Users/Gurkirat%20singh/Downloads/myproject/.env.local" style={{ textDecoration: "underline", color: "inherit" }}>.env.local</a> and replace the placeholder values.</li>
                <li>Restart your local development server.</li>
              </ol>
            </div>
          </div>
        ) : isVerified && verifiedSummary && verifiedCust ? (
          <div>
            {/* Header section with back option */}
            <div className="flex-between mb-md">
              <button onClick={handleLockSession} className="btn btn-outline" style={{ width: "auto", padding: "0.5rem 1rem" }}>
                <ArrowLeft size={16} /> Lock & Return
              </button>
              <div className="interest-badge">
                <Unlock size={14} /> Unlocked Session
              </div>
            </div>

            <div className="mb-md">
              <span className="text-muted">Welcome, customer</span>
              <h1 style={{ fontSize: "clamp(1.5rem, 5vw, 2rem)", marginTop: "0.25rem", fontFamily: "var(--font-mono)", wordBreak: "break-word" }}>
                {verifiedCust.name}
              </h1>
            </div>

            {/* Main info grid */}
            <div className="dashboard-grid">
              
              {/* Account Balance Summary */}
              <div className="card">
                <h3 className="card-title">
                  <User size={16} /> Balance Summary
                </h3>
                
                <div>
                  <span className="text-muted">Total Pending Payment</span>
                  <div className="summary-balance-value">
                    ₹{verifiedSummary.totalPendingPayment.toFixed(2)}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "1.5rem" }}>
                  <div className="flex-between text-muted" style={{ paddingBottom: "0.5rem", borderBottom: "1px solid var(--border-color)", flexWrap: "wrap", gap: "0.5rem" }}>
                    <span>Original Charges Balance:</span>
                    <span className="mono-font" style={{ color: "var(--text-primary)" }}>
                      ₹{verifiedSummary.totalPrincipalUnpaid.toFixed(2)}
                    </span>
                  </div>
                  
                  <div className="flex-between text-muted" style={{ paddingBottom: "0.5rem", borderBottom: "1px solid var(--border-color)", flexWrap: "wrap", gap: "0.5rem" }}>
                    <span>Accumulated Interest:</span>
                    <span className="mono-font" style={{ color: verifiedSummary.totalInterestAccumulated > 0 ? "var(--warning)" : "var(--text-primary)" }}>
                      ₹{verifiedSummary.totalInterestAccumulated.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex-between text-muted" style={{ paddingBottom: "0.5rem", flexWrap: "wrap", gap: "0.5rem" }}>
                    <span>Total Payments Logged:</span>
                    <span className="mono-font" style={{ color: "var(--success)" }}>
                      ₹{verifiedSummary.totalPaymentsMade.toFixed(2)}
                    </span>
                  </div>
                </div>

                {verifiedSummary.totalInterestAccumulated > 0 ? (
                  <div className="alert alert-warning mt-md" style={{ marginBottom: 0 }}>
                    <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                    <div>
                      <strong>Interest Charges Applied</strong>
                      <p style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>
                        Additional interest of {process.env.NEXT_PUBLIC_INTEREST_RATE_PERCENT || "5.0"}% is calculated on charges older than {process.env.NEXT_PUBLIC_INTEREST_GRACE_DAYS || "30"} days.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="alert alert-success mt-md" style={{ marginBottom: 0 }}>
                    <CheckCircle size={16} style={{ flexShrink: 0 }} />
                    <div>
                      <strong>Account in Good Standing</strong>
                      <p style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>
                        No interest penalties applied to date. Pay within the grace period to avoid penalties.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* QR Scanner Card */}
              <div className="card text-center" style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
                <h3 className="card-title" style={{ width: "100%" }}>
                  <QrCode size={16} /> Scan to Pay
                </h3>

                {verifiedSummary.totalPendingPayment > 0 ? (
                  <>
                    <div style={{ margin: "1rem 0" }}>
                      {/* Using the QR api to render dynamic code */}
                      <img 
                        src={getUpiQrUrl()} 
                        alt="UPI Payment QR Code" 
                        style={{ border: "1px solid var(--border-color)", padding: "0.5rem", borderRadius: "var(--radius-md)" }}
                        width={200}
                        height={200}
                      />
                    </div>
                    
                    <div style={{ marginBottom: "1rem", width: "100%" }}>
                      <p className="mono-font" style={{ fontSize: "0.9rem", fontWeight: "700", wordBreak: "break-all" }}>
                        UPI ID: {process.env.NEXT_PUBLIC_UPI_ID || "printshop@upi"}
                      </p>
                      <p className="text-muted" style={{ fontSize: "0.8rem", marginTop: "0.25rem", wordBreak: "break-word" }}>
                        Merchant Name: {process.env.NEXT_PUBLIC_MERCHANT_NAME || "Quantum Printing"}
                      </p>
                    </div>

                    <div className="alert alert-info" style={{ marginBottom: 0, textAlign: "left" }}>
                      <RefreshCw size={16} className="animate-spin" style={{ flexShrink: 0, marginTop: "2px" }} />
                      <div>
                        <strong>Manual Verification Required</strong>
                        <p style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>
                          Once scanned and paid, your balance will be processed and updated manually by our shop administrator within <strong>48 hours</strong>.
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ padding: "3rem 1.5rem" }}>
                    <CheckCircle size={48} style={{ color: "var(--success)", marginBottom: "1rem" }} />
                    <p style={{ fontWeight: "600" }}>No outstanding balance due.</p>
                    <p className="text-muted" style={{ fontSize: "0.85rem", marginTop: "0.5rem" }}>
                      Thank you for keeping your account updated!
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Transaction History Section */}
            <div className="card mt-lg">
              <h3 className="card-title">
                <Calendar size={16} /> Transaction History
              </h3>
              
              {verifiedSummary.history.length === 0 ? (
                <p className="text-muted" style={{ padding: "1.5rem 0" }}>No transaction records found.</p>
              ) : (
                <div className="transaction-list">
                  {verifiedSummary.history.map((tx) => (
                    <div key={tx.id} className="transaction-item">
                      <div className="tx-details" style={{ width: "100%" }}>
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                          <span className="tx-reason" style={{ wordBreak: "break-word" }}>{tx.reason}</span>
                          <span className={`tx-type-pill ${tx.type === "charge" ? "tx-type-charge" : "tx-type-payment"}`}>
                            {tx.type}
                          </span>
                        </div>
                        <span className="tx-date">{formatDate(tx.created_at)}</span>
                        {tx.type === "charge" && tx.due_date && (
                          <span className="text-muted" style={{ fontSize: "0.7rem", marginTop: "0.1rem" }}>
                            Interest Grace Due: {formatShortDate(tx.due_date)}
                          </span>
                        )}
                      </div>
                      <span className={`tx-amount ${tx.type === "charge" ? "tx-amount-charge" : "tx-amount-payment"}`}>
                        {tx.type === "charge" ? "+" : "-"} ₹{tx.amount.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        ) : (
          /* Landing page: list of names with blurred amounts */
          <div>
            <div style={{ textAlign: "center", padding: "2rem 0", maxWidth: "600px", margin: "0 auto 2.5rem" }}>
              <span className="mono-font" style={{ textTransform: "uppercase", fontSize: "0.8rem", color: "var(--text-secondary)", letterSpacing: "2px" }}>
                Printing Shop Board
              </span>
              <h1 style={{ fontSize: "clamp(1.8rem, 6vw, 2.5rem)", marginTop: "0.5rem", marginBottom: "1rem", fontFamily: "var(--font-mono)", lineHeight: "1.2" }}>
                Pending Payments
              </h1>
              <p className="text-muted" style={{ lineHeight: "1.6" }}>
                Select your name from the directory below and verify your mobile number and date of birth to securely access your pending invoices, scan to pay, and view history.
              </p>
            </div>

            {/* Search filter */}
            <div className="search-container" style={{ maxWidth: "450px", margin: "0 auto 2rem" }}>
              <div style={{ position: "relative", width: "100%" }}>
                <Search size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} />
                <input 
                  type="text" 
                  placeholder="Search your name..." 
                  className="form-input search-input"
                  style={{ paddingLeft: "2.5rem" }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Directory list */}
            {loadingList ? (
              <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", padding: "4rem" }} className="text-muted mono-font">
                <RefreshCw className="animate-spin" size={16} /> Loading directory...
              </div>
            ) : listError ? (
              <div className="alert alert-danger" style={{ maxWidth: "500px", margin: "0 auto" }}>
                <AlertTriangle size={16} /> {listError}
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="text-center text-muted" style={{ padding: "4rem" }}>
                No customers found matching &quot;{searchQuery}&quot;.
              </div>
            ) : (
              <div className="customer-selection-grid">
                {filteredCustomers.map((cust) => (
                  <button 
                    key={cust.id} 
                    className="card customer-select-card"
                    onClick={() => handleSelectCustomer(cust)}
                  >
                    <div className="flex-between">
                      <div className="customer-name-large">{cust.name}</div>
                      <Lock size={16} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
                    </div>
                    <div className="customer-status-pill mono-font">
                      🔐 Details Hidden • Click to Verify
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Verification Modal */}
      {showVerifyModal && selectedCust && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Verify Identity</h3>
              <button className="modal-close" onClick={() => setShowVerifyModal(false)}>✕</button>
            </div>
            
            <p className="text-muted mb-md" style={{ fontSize: "0.85rem" }}>
              To view details for <strong>{selectedCust.name}</strong>, please verify your details:
            </p>

            <form onSubmit={handleVerifySubmit}>
              <div className="form-group">
                <label className="form-label">
                  <Phone size={12} style={{ display: "inline", marginRight: "4px" }} /> Mobile Number
                </label>
                <input 
                  type="tel" 
                  className="form-input" 
                  placeholder="Enter registered mobile number"
                  required
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  disabled={isPending}
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <Calendar size={12} style={{ display: "inline", marginRight: "4px" }} /> Date of Birth
                </label>
                <input 
                  type="date" 
                  className="form-input" 
                  required
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  disabled={isPending}
                />
              </div>

              {errorMsg && (
                <div className="alert alert-danger" style={{ fontSize: "0.8rem", padding: "0.75rem" }}>
                  <AlertTriangle size={14} style={{ marginTop: "2px" }} /> {errorMsg}
                </div>
              )}

              <div className="flex-between gap-sm mt-md">
                <button 
                  type="button" 
                  className="btn btn-outline" 
                  onClick={() => setShowVerifyModal(false)}
                  disabled={isPending}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={isPending}
                >
                  {isPending ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" /> Verifying...
                    </>
                  ) : (
                    "Verify & Open"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="footer">
        <div>
          © {new Date().getFullYear()} {process.env.NEXT_PUBLIC_MERCHANT_NAME || "Quantum Printing Shop"}. All rights reserved.
        </div>
        <div style={{ marginTop: "0.5rem", fontSize: "0.75rem" }} className="text-muted">
          Design system built with Space Mono & Plus Jakarta Sans.
        </div>
      </footer>
    </>
  );
}
