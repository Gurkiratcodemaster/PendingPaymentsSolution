/**
 * Interest calculation and transaction matching utility (FIFO logic)
 */

const DEFAULT_RATE = parseFloat(process.env.NEXT_PUBLIC_INTEREST_RATE_PERCENT || '5.0');
const DEFAULT_PERIOD = process.env.NEXT_PUBLIC_INTEREST_PERIOD || 'monthly'; // 'daily', 'monthly', 'yearly'
const DEFAULT_GRACE_DAYS = parseInt(process.env.NEXT_PUBLIC_INTEREST_GRACE_DAYS || '30', 10);

/**
 * Calculates interest on an outstanding principal amount
 * @param {number} principal - Unpaid principal amount
 * @param {Date} dueDate - Date when payment was due
 * @param {Date} now - Current comparison date
 * @returns {object} - Calculated interest, days overdue, and status
 */
export function calculateChargeInterest(principal, dueDate, now = new Date()) {
  const due = new Date(dueDate);
  const timeDiff = now.getTime() - due.getTime();
  
  if (timeDiff <= 0 || principal <= 0) {
    return { interest: 0, daysOverdue: 0, isOverdue: false };
  }

  const daysOverdue = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  if (daysOverdue <= 0) {
    return { interest: 0, daysOverdue: 0, isOverdue: false };
  }

  let periods = 0;
  if (DEFAULT_PERIOD === 'daily') {
    periods = daysOverdue;
  } else if (DEFAULT_PERIOD === 'yearly') {
    periods = daysOverdue / 365.25;
  } else {
    // Default to monthly
    periods = daysOverdue / 30.44; // average days in a month
  }

  const interest = principal * (DEFAULT_RATE / 100) * periods;
  return {
    interest: Math.round(interest * 100) / 100, // round to 2 decimal places
    daysOverdue,
    isOverdue: true
  };
}

/**
 * Processes a list of transactions for a customer using FIFO (First-In, First-Out) logic
 * to apply payments to charges, and dynamically calculates interest on remaining balances.
 * 
 * @param {Array} transactions - All transactions for the customer
 * @param {Date} now - Current time for calculation
 * @returns {object} - Summary including outstanding balance, total interest, and processed history
 */
export function processCustomerTransactions(transactions, now = new Date()) {
  // Separate into charges and payments
  const charges = [];
  const payments = [];

  // Clone and sort transactions by created_at
  const sortedTx = [...transactions].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  for (const tx of sortedTx) {
    if (tx.type === 'charge') {
      // Set due date if not present: created_at + grace days
      const createdDate = new Date(tx.created_at);
      const dueDate = tx.due_date 
        ? new Date(tx.due_date) 
        : new Date(createdDate.getTime() + DEFAULT_GRACE_DAYS * 24 * 60 * 60 * 1000);

      charges.push({
        ...tx,
        due_date: dueDate,
        originalAmount: parseFloat(tx.amount),
        remainingPrincipal: parseFloat(tx.amount),
        interestAccumulated: 0,
        daysOverdue: 0,
        isOverdue: false,
        paymentApplications: []
      });
    } else if (tx.type === 'payment') {
      payments.push({
        ...tx,
        amount: parseFloat(tx.amount),
        remainingFunds: parseFloat(tx.amount)
      });
    }
  }

  // Calculate total payment pool
  let paymentPool = payments.reduce((sum, p) => sum + p.amount, 0);
  const initialPaymentPool = paymentPool;

  // Apply payments to charges in FIFO order
  for (const charge of charges) {
    if (paymentPool <= 0) {
      // No payments left, calculate interest on full original amount
      const intInfo = calculateChargeInterest(charge.remainingPrincipal, charge.due_date, now);
      charge.interestAccumulated = intInfo.interest;
      charge.daysOverdue = intInfo.daysOverdue;
      charge.isOverdue = intInfo.isOverdue;
      continue;
    }

    if (paymentPool >= charge.remainingPrincipal) {
      // Payment covers the full principal of this charge
      const applied = charge.remainingPrincipal;
      paymentPool -= applied;
      charge.remainingPrincipal = 0;
      charge.interestAccumulated = 0;
      charge.daysOverdue = 0;
      charge.isOverdue = false;
      charge.paymentApplications.push({ amount: applied, date: now }); // simplified
    } else {
      // Payment partially covers this charge
      const applied = paymentPool;
      charge.remainingPrincipal -= applied;
      paymentPool = 0;
      charge.paymentApplications.push({ amount: applied, date: now });

      // Calculate interest on the remaining unpaid principal
      const intInfo = calculateChargeInterest(charge.remainingPrincipal, charge.due_date, now);
      charge.interestAccumulated = intInfo.interest;
      charge.daysOverdue = intInfo.daysOverdue;
      charge.isOverdue = intInfo.isOverdue;
    }
  }

  // Calculate totals
  const totalPrincipalCharged = charges.reduce((sum, c) => sum + c.originalAmount, 0);
  const totalPrincipalUnpaid = charges.reduce((sum, c) => sum + c.remainingPrincipal, 0);
  const totalInterestAccumulated = charges.reduce((sum, c) => sum + c.interestAccumulated, 0);
  
  // Total pending payment is (remaining principal + accumulated interest) - any leftover excess payments
  const totalPaymentsMade = initialPaymentPool;
  const leftoverPayments = paymentPool; // if customer paid extra
  const totalPendingPayment = Math.max(0, totalPrincipalUnpaid + totalInterestAccumulated - leftoverPayments);

  // Build a timeline-friendly history of actions
  const history = sortedTx.map(tx => {
    return {
      id: tx.id,
      type: tx.type,
      amount: parseFloat(tx.amount),
      reason: tx.reason,
      created_at: tx.created_at,
      due_date: tx.due_date
    };
  });

  return {
    totalPrincipalCharged,
    totalPrincipalUnpaid,
    totalInterestAccumulated,
    totalPaymentsMade,
    totalPendingPayment: Math.round(totalPendingPayment * 100) / 100,
    chargesDetails: charges,
    history
  };
}
