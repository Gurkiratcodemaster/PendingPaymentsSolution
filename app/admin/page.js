"use client";

import React, { useState, useEffect, useTransition } from "react";
import { 
  Plus, 
  Search, 
  Trash2, 
  LogOut, 
  UserPlus, 
  DollarSign, 
  Calendar, 
  Phone, 
  User, 
  ChevronRight, 
  AlertTriangle,
  CheckCircle,
  FileText,
  Key,
  RefreshCw
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { processCustomerTransactions } from "@/lib/interest";

export default function AdminDashboard() {
  // Auth states
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  // Data states
  const [customers, setCustomers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState("");

  // Modals / Form states
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustMobile, setNewCustMobile] = useState("");
  const [newCustDob, setNewCustDob] = useState("");
  const [newCustInitialCharge, setNewCustInitialCharge] = useState("");
  const [newCustInitialReason, setNewCustInitialReason] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Selected customer for detail view / editing
  const [selectedCust, setSelectedCust] = useState(null);
  const [selectedCustTx, setSelectedCustTx] = useState([]);
  const [showAddTxModal, setShowAddTxModal] = useState(false);
  const [txType, setTxType] = useState("charge"); // 'charge' or 'payment'
  const [txAmount, setTxAmount] = useState("");
  const [txReason, setTxReason] = useState("");
  const [txError, setTxError] = useState("");

  const [isPending, startTransition] = useTransition();

  const [isConfigMissing, setIsConfigMissing] = useState(false);

  // Check auth session on mount
  useEffect(() => {
    async function checkUser() {
      setAuthLoading(true);
      
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (
        !supabaseUrl ||
        !supabaseAnonKey ||
        supabaseUrl.includes("your-project-id") ||
        supabaseAnonKey.includes("your-anon-public-key")
      ) {
        setIsConfigMissing(true);
        setAuthLoading(false);
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setIsAdmin(true);
        }
      } catch (err) {
        console.error("Session check failed:", err);
      }
      setAuthLoading(false);
    }
    checkUser();
  }, []);

  // Fetch all customers & transactions once authenticated
  useEffect(() => {
    if (isAdmin) {
      loadDashboardData();
    }
  }, [isAdmin]);

  const loadDashboardData = async () => {
    setLoadingData(true);
    setDataError("");
    try {
      // Fetch customers
      const { data: custData, error: custErr } = await supabase
        .from("customers")
        .select("*")
        .order("name", { ascending: true });

      if (custErr) throw custErr;

      // Fetch all transactions
      const { data: txData, error: txErr } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: true });

      if (txErr) throw txErr;

      setCustomers(custData || []);
      setTransactions(txData || []);

      // If a customer was already selected, update their specific transaction state
      if (selectedCust) {
        const updatedTx = txData.filter(tx => tx.customer_id === selectedCust.id);
        setSelectedCustTx(updatedTx);
      }
    } catch (err) {
      console.error("Error loading dashboard data:", err);
      setDataError("Failed to fetch dashboard data: " + err.message);
    } finally {
      setLoadingData(false);
    }
  };

  // Handle Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password: adminPassword,
      });
      if (error) {
        setAuthError(error.message);
      } else {
        setIsAdmin(true);
      }
    } catch (err) {
      setAuthError("An unexpected error occurred during login.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
    setSelectedCust(null);
  };

  // Add Customer Submit
  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!newCustName || !newCustMobile || !newCustDob) {
      setFormError("All fields except initial charge are required.");
      return;
    }

    const initialChargeVal = parseFloat(newCustInitialCharge || "0");
    if (newCustInitialCharge && (isNaN(initialChargeVal) || initialChargeVal < 0)) {
      setFormError("Initial charge must be a valid positive number.");
      return;
    }

    if (initialChargeVal > 0 && !newCustInitialReason) {
      setFormError("A reason is required when adding an initial pending charge.");
      return;
    }

    setLoadingData(true);

    try {
      // 1. Create the customer record
      const { data: createdCust, error: custErr } = await supabase
        .from("customers")
        .insert([{
          name: newCustName.trim(),
          mobile_number: newCustMobile.trim(),
          dob: newCustDob,
        }])
        .select()
        .single();

      if (custErr) throw custErr;

      // 2. If initial charge is > 0, insert a transaction
      if (initialChargeVal > 0) {
        const graceDays = parseInt(process.env.NEXT_PUBLIC_INTEREST_GRACE_DAYS || "30", 10);
        const dueDate = new Date(Date.now() + graceDays * 24 * 60 * 60 * 1000);

        const { error: txErr } = await supabase
          .from("transactions")
          .insert([{
            customer_id: createdCust.id,
            type: "charge",
            amount: initialChargeVal,
            reason: newCustInitialReason.trim(),
            due_date: dueDate.toISOString(),
          }]);

        if (txErr) throw txErr;
      }

      setFormSuccess(`Successfully created customer "${newCustName}"!`);
      // Reset fields
      setNewCustName("");
      setNewCustMobile("");
      setNewCustDob("");
      setNewCustInitialCharge("");
      setNewCustInitialReason("");
      
      // Reload lists
      await loadDashboardData();
    } catch (err) {
      console.error("Error creating customer:", err);
      setFormError(err.message || "Failed to create customer.");
    } finally {
      setLoadingData(false);
    }
  };

  // Add Transaction (Charge/Payment) to Selected Customer
  const handleAddTransaction = async (e) => {
    e.preventDefault();
    setTxError("");

    const amountVal = parseFloat(txAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      setTxError("Amount must be a positive number.");
      return;
    }

    if (!txReason) {
      setTxError("Reason/notes are required.");
      return;
    }

    setLoadingData(true);

    try {
      let dueDate = null;
      if (txType === "charge") {
        const graceDays = parseInt(process.env.NEXT_PUBLIC_INTEREST_GRACE_DAYS || "30", 10);
        dueDate = new Date(Date.now() + graceDays * 24 * 60 * 60 * 1000).toISOString();
      }

      const { error } = await supabase
        .from("transactions")
        .insert([{
          customer_id: selectedCust.id,
          type: txType,
          amount: amountVal,
          reason: txReason.trim(),
          due_date: dueDate,
        }]);

      if (error) throw error;

      // Reset transaction modal values
      setTxAmount("");
      setTxReason("");
      setShowAddTxModal(false);

      // Reload
      await loadDashboardData();
    } catch (err) {
      console.error("Error adding transaction:", err);
      setTxError(err.message || "Failed to log transaction.");
    } finally {
      setLoadingData(false);
    }
  };

  // Delete Customer
  const handleDeleteCustomer = async (customerId, customerName) => {
    if (!confirm(`Are you sure you want to delete customer "${customerName}" and all their transaction history?`)) {
      return;
    }

    setLoadingData(true);
    try {
      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", customerId);

      if (error) throw error;

      if (selectedCust && selectedCust.id === customerId) {
        setSelectedCust(null);
        setSelectedCustTx([]);
      }

      await loadDashboardData();
    } catch (err) {
      console.error("Error deleting customer:", err);
      alert("Failed to delete customer: " + err.message);
    } finally {
      setLoadingData(false);
    }
  };

  // Select Customer & Load details
  const handleOpenCustomer = (cust) => {
    setSelectedCust(cust);
    const custTx = transactions.filter(tx => tx.customer_id === cust.id);
    setSelectedCustTx(custTx);
  };

  // Calculate dynamic data mapping for each customer
  const getCustomerSummaries = () => {
    return customers.map(cust => {
      const custTx = transactions.filter(tx => tx.customer_id === cust.id);
      const summary = processCustomerTransactions(custTx, new Date());
      return {
        ...cust,
        summary
      };
    });
  };

  const customerSummaries = getCustomerSummaries();

  // Filter admin directory
  const filteredSummaries = customerSummaries.filter(cust => 
    cust.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cust.mobile_number.includes(searchQuery)
  );

  const activeCustomerSummary = selectedCust
    ? processCustomerTransactions(selectedCustTx, new Date())
    : null;

  // Format Dates
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

  // Show Auth Loading
  if (authLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", justifyContent: "center", alignItems: "center" }} className="text-muted mono-font">
        <RefreshCw className="animate-spin" size={24} style={{ marginBottom: "1rem" }} />
        Checking administrator session...
      </div>
    );
  }

  // Show Configuration Missing panel
  if (isConfigMissing) {
    return (
      <div style={{ display: "flex", flex: 1, justifyContent: "center", alignItems: "center", minHeight: "100vh", padding: "1.5rem" }}>
        <div className="card" style={{ maxWidth: "600px", width: "100%", padding: "2.5rem 2rem" }}>
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
            <AlertTriangle size={48} style={{ color: "var(--warning)", marginBottom: "0.5rem" }} />
            <h2 style={{ fontSize: "1.75rem", fontFamily: "var(--font-mono)" }}>Admin Config Required</h2>
          </div>
          
          <p className="text-muted" style={{ lineHeight: "1.6", marginBottom: "1.5rem" }}>
            The admin dashboard is unable to access Supabase because the API credentials are still set to placeholders in your <code>.env.local</code> file.
          </p>

          <div className="alert alert-info" style={{ textAlign: "left", display: "block" }}>
            <h4 style={{ fontWeight: 600, marginBottom: "0.5rem" }}>How to fix this:</h4>
            <ol style={{ paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.85rem" }}>
              <li>Create a project on <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline", color: "inherit" }}>Supabase</a>.</li>
              <li>Go to the SQL Editor, copy the database script from <a href="file:///c:/Users/Gurkirat%20singh/Downloads/myproject/supabase_help.md" style={{ textDecoration: "underline", color: "inherit" }}>supabase_help.md</a>, and run it.</li>
              <li>Under Project Settings → API in your Supabase dashboard, copy your <strong>Project URL</strong>, <strong>anon key</strong>, and <strong>service_role key</strong>.</li>
              <li>Open <a href="file:///c:/Users/Gurkirat%20singh/Downloads/myproject/.env.local" style={{ textDecoration: "underline", color: "inherit" }}>.env.local</a> and replace the placeholder values.</li>
              <li>Restart your local development server to load the new env variables.</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  // Admin Log In page if not logged in
  if (!isAdmin) {
    return (
      <div style={{ display: "flex", flex: 1, justifyContent: "center", alignItems: "center", minHeight: "100vh", padding: "1.5rem" }}>
        <div className="card" style={{ maxWidth: "420px", width: "100%", padding: "2rem" }}>
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <Key size={36} style={{ color: "var(--text-secondary)", marginBottom: "0.75rem" }} />
            <h1 style={{ fontSize: "1.75rem", fontFamily: "var(--font-mono)" }}>Admin Portal</h1>
            <p className="text-muted" style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>
              Enter email & password to access printing shop controls.
            </p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input 
                type="email" 
                className="form-input" 
                placeholder="admin@shop.com"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: "1.75rem" }}>
              <label className="form-label">Password</label>
              <input 
                type="password" 
                className="form-input" 
                placeholder="••••••••"
                required
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
              />
            </div>

            {authError && (
              <div className="alert alert-danger" style={{ fontSize: "0.8rem", padding: "0.75rem" }}>
                <AlertTriangle size={14} style={{ marginTop: "2px" }} /> {authError}
              </div>
            )}

            <button type="submit" className="btn btn-primary">
              Access Dashboard
            </button>
          </form>

          <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
            <a href="/" style={{ fontSize: "0.85rem" }} className="text-muted footer-link">
              ← Go back to Public Portal
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Admin Dashboard Content (Authenticated)
  return (
    <>
      {/* Header */}
      <header className="navbar">
        <div className="nav-logo">
          <Key size={18} />
          <span>SHOP.ADMIN</span>
        </div>
        <div className="nav-links">
          <a href="/" className="btn-nav btn-nav-outline">
            Customer View
          </a>
          <button onClick={handleLogout} className="btn-nav btn-nav-outline" style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <LogOut size={14} /> Log Out
          </button>
        </div>
      </header>

      <main className="main-container">
        
        {/* Top welcome layout */}
        <div className="flex-between mb-md">
          <div>
            <span className="mono-font text-muted">CONTROL DASHBOARD</span>
            <h1 style={{ fontSize: "2rem", marginTop: "0.25rem", fontFamily: "var(--font-mono)" }}>
              Pending Accounts
            </h1>
          </div>
          
          <button 
            onClick={() => setShowAddCustomer(!showAddCustomer)} 
            className="btn btn-primary"
            style={{ width: "auto" }}
          >
            <Plus size={16} /> {showAddCustomer ? "Close Creator" : "New Customer"}
          </button>
        </div>

        {/* Global Loading Spinner for updates */}
        {loadingData && (
          <div className="alert alert-info" style={{ display: "inline-flex", gap: "0.5rem", alignItems: "center", padding: "0.5rem 1rem", fontSize: "0.8rem" }}>
            <RefreshCw className="animate-spin" size={14} /> Refreshing database rows...
          </div>
        )}

        {dataError && (
          <div className="alert alert-danger">
            <AlertTriangle size={16} /> {dataError}
          </div>
        )}

        {/* Create Customer Drawer */}
        {showAddCustomer && (
          <div className="card mb-md" style={{ borderStyle: "dashed" }}>
            <h3 className="card-title">
              <UserPlus size={16} /> Create Customer Profile
            </h3>
            
            <form onSubmit={handleCreateCustomer} style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1rem" }}>
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Full Name</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="John Doe"
                    required
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Mobile Number</label>
                  <input 
                    type="tel" 
                    className="form-input" 
                    placeholder="9876543210"
                    required
                    value={newCustMobile}
                    onChange={(e) => setNewCustMobile(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Date of Birth</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    required
                    value={newCustDob}
                    onChange={(e) => setNewCustDob(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-grid-split" style={{ borderTop: "1px solid var(--border-color)", paddingTop: "1rem" }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Initial Pending Amt (₹)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="form-input" 
                    placeholder="0.00 (Optional)"
                    value={newCustInitialCharge}
                    onChange={(e) => setNewCustInitialCharge(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Reason for Charge</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Required if initial charge > 0 (e.g. Printing 100 Flyers)"
                    value={newCustInitialReason}
                    onChange={(e) => setNewCustInitialReason(e.target.value)}
                  />
                </div>
              </div>

              {formError && (
                <div className="alert alert-danger" style={{ fontSize: "0.85rem", margin: 0 }}>
                  <AlertTriangle size={16} /> {formError}
                </div>
              )}

              {formSuccess && (
                <div className="alert alert-success" style={{ fontSize: "0.85rem", margin: 0 }}>
                  <CheckCircle size={16} /> {formSuccess}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="submit" className="btn btn-primary" style={{ width: "auto" }}>
                  Save & Create Profile
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Dashboard Content Grid */}
        <div className={`dashboard-grid ${selectedCust ? 'admin-split-view' : ''}`} style={{ gridTemplateColumns: selectedCust ? undefined : "1fr" }}>
          
          {/* Customer Directory List */}
          <div className="card">
            <h3 className="card-title">
              <User size={16} /> Customer Profiles
            </h3>

            {/* Search filter */}
            <div className="search-container">
              <div style={{ position: "relative", width: "100%" }}>
                <Search size={16} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} />
                <input 
                  type="text" 
                  placeholder="Search name or mobile..." 
                  className="form-input"
                  style={{ paddingLeft: "2.25rem", paddingRight: "1rem" }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {filteredSummaries.length === 0 ? (
              <p className="text-muted text-center" style={{ padding: "2rem" }}>No customer records found.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "600px", overflowY: "auto" }}>
                {filteredSummaries.map(cust => (
                  <div 
                    key={cust.id} 
                    className={`transaction-item ${selectedCust?.id === cust.id ? 'active-profile' : ''}`}
                    style={{ 
                      cursor: "pointer", 
                      padding: "0.75rem 1rem",
                      borderColor: selectedCust?.id === cust.id ? "var(--border-color-focus)" : "var(--border-color)",
                      backgroundColor: selectedCust?.id === cust.id ? "var(--bg-tertiary)" : "var(--bg-primary)"
                    }}
                    onClick={() => handleOpenCustomer(cust)}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                      <span style={{ fontWeight: "600", fontSize: "0.95rem" }}>{cust.name}</span>
                      <span className="text-muted" style={{ fontSize: "0.75rem", display: "flex", gap: "0.5rem" }}>
                        <span>📱 {cust.mobile_number}</span>
                        <span>🎂 {formatShortDate(cust.dob)}</span>
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <div className="text-right">
                        <span className="mono-font" style={{ fontWeight: "700", display: "block" }}>
                          ₹{cust.summary.totalPendingPayment.toFixed(2)}
                        </span>
                        <span className="text-muted" style={{ fontSize: "0.65rem" }}>
                          {cust.summary.totalInterestAccumulated > 0 ? "⚠️ plus interest" : "clear of penalties"}
                        </span>
                      </div>
                      <ChevronRight size={16} className="text-muted" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Customer Details & History Management Panel */}
          {selectedCust && activeCustomerSummary && (
            <div className="card">
              <div className="flex-between mb-md" style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "0.75rem" }}>
                <div>
                  <span className="mono-font text-muted" style={{ fontSize: "0.75rem" }}>PROFILE INVOICES</span>
                  <h2 style={{ fontSize: "1.5rem", fontFamily: "var(--font-mono)" }}>
                    {selectedCust.name}
                  </h2>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button 
                    onClick={() => setShowAddTxModal(true)} 
                    className="btn btn-primary"
                    style={{ width: "auto", padding: "0.5rem 0.75rem", fontSize: "0.8rem" }}
                  >
                    <Plus size={14} /> Log Action
                  </button>
                  <button 
                    onClick={() => handleDeleteCustomer(selectedCust.id, selectedCust.name)} 
                    className="btn btn-outline"
                    style={{ width: "auto", color: "var(--danger)", borderColor: "rgba(239, 68, 68, 0.2)", padding: "0.5rem" }}
                    title="Delete Customer Profile"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Profile Details Cards */}
              <div className="details-grid-two-col" style={{ marginBottom: "1.5rem" }}>
                <div className="card" style={{ padding: "1rem", background: "var(--bg-secondary)" }}>
                  <span className="text-muted" style={{ fontSize: "0.7rem", textTransform: "uppercase" }}>Pending Invoice</span>
                  <div className="mono-font" style={{ fontSize: "1.25rem", fontWeight: "700", marginTop: "0.25rem" }}>
                    ₹{activeCustomerSummary.totalPendingPayment.toFixed(2)}
                  </div>
                  <span className="text-muted" style={{ fontSize: "0.65rem" }}>
                    Orig Principal: ₹{activeCustomerSummary.totalPrincipalUnpaid.toFixed(2)}
                  </span>
                </div>

                <div className="card" style={{ padding: "1rem", background: "var(--bg-secondary)" }}>
                  <span className="text-muted" style={{ fontSize: "0.7rem", textTransform: "uppercase" }}>Interest Charged</span>
                  <div className="mono-font" style={{ fontSize: "1.25rem", fontWeight: "700", marginTop: "0.25rem", color: activeCustomerSummary.totalInterestAccumulated > 0 ? "var(--warning)" : "var(--text-primary)" }}>
                    ₹{activeCustomerSummary.totalInterestAccumulated.toFixed(2)}
                  </div>
                  <span className="text-muted" style={{ fontSize: "0.65rem" }}>
                    Rate: {process.env.NEXT_PUBLIC_INTEREST_RATE_PERCENT || "5.0"}% ({process.env.NEXT_PUBLIC_INTEREST_PERIOD || "monthly"})
                  </span>
                </div>
              </div>

              {/* Detail view of all history */}
              <h4 className="mono-font mb-md" style={{ fontSize: "0.85rem", textTransform: "uppercase", color: "var(--text-secondary)" }}>
                Transaction Ledger
              </h4>
              
              {selectedCustTx.length === 0 ? (
                <p className="text-muted" style={{ padding: "1.5rem 0" }}>No transaction records for this profile.</p>
              ) : (
                <div className="transaction-list" style={{ maxHeight: "320px" }}>
                  {activeCustomerSummary.history.map((tx) => (
                    <div key={tx.id} className="transaction-item">
                      <div className="tx-details">
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                          <span className="tx-reason">{tx.reason}</span>
                          <span className={`tx-type-pill ${tx.type === "charge" ? "tx-type-charge" : "tx-type-payment"}`}>
                            {tx.type}
                          </span>
                        </div>
                        <span className="tx-date">{formatDate(tx.created_at)}</span>
                        {tx.type === "charge" && tx.due_date && (
                          <span className="text-muted" style={{ fontSize: "0.65rem", marginTop: "0.1rem" }}>
                            Grace Period Due: {formatShortDate(tx.due_date)}
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className={`tx-amount ${tx.type === "charge" ? "tx-amount-charge" : "tx-amount-payment"}`}>
                          {tx.type === "charge" ? "+" : "-"} ₹{tx.amount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Add Transaction Modal */}
      {showAddTxModal && selectedCust && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Log Customer Action</h3>
              <button className="modal-close" onClick={() => setShowAddTxModal(false)}>✕</button>
            </div>

            <p className="text-muted mb-md" style={{ fontSize: "0.85rem" }}>
              Add a new charge or register a payment for <strong>{selectedCust.name}</strong>.
            </p>

            <form onSubmit={handleAddTransaction}>
              <div className="form-group">
                <label className="form-label">Action Type</label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button 
                    type="button" 
                    className={`btn ${txType === "charge" ? "btn-primary" : "btn-outline"}`}
                    style={{ flex: 1 }}
                    onClick={() => setTxType("charge")}
                  >
                    📈 Add Charge (Due)
                  </button>
                  <button 
                    type="button" 
                    className={`btn ${txType === "payment" ? "btn-primary" : "btn-outline"}`}
                    style={{ flex: 1 }}
                    onClick={() => setTxType("payment")}
                  >
                    📉 Log Payment (Paid)
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Transaction Amount (₹)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="form-input" 
                  placeholder="0.00"
                  required
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Reason / Item Notes</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder={txType === "charge" ? "e.g., Printing 50 flyers" : "e.g., Paid via UPI scan / Cash"}
                  required
                  value={txReason}
                  onChange={(e) => setTxReason(e.target.value)}
                />
              </div>

              {txError && (
                <div className="alert alert-danger" style={{ fontSize: "0.8rem", padding: "0.75rem" }}>
                  <AlertTriangle size={14} style={{ marginTop: "2px" }} /> {txError}
                </div>
              )}

              <div className="flex-between gap-sm mt-md">
                <button 
                  type="button" 
                  className="btn btn-outline" 
                  onClick={() => setShowAddTxModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Record Action
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
