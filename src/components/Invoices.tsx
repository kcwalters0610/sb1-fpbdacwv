import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Search, Eye, DollarSign, FileText, Calendar, User, Building, Phone, Mail, MapPin, Edit, Trash2, CreditCard, X } from 'lucide-react';

interface Invoice {
  id: string;
  company_id: string;
  customer_id: string;
  work_order_id?: string;
  invoice_number: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  issue_date: string;
  due_date?: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  payment_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  customers?: {
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
    company_name?: string;
    customer_type: 'residential' | 'commercial';
  };
  work_orders?: {
    wo_number: string;
    title: string;
  };
  payments?: Payment[];
}

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  company_name?: string;
  customer_type: 'residential' | 'commercial';
}

interface WorkOrder {
  id: string;
  wo_number: string;
  title: string;
}

interface PaymentForm {
  amount: number;
  payment_method: 'check' | 'cash' | 'card' | 'ach' | 'wire' | 'other';
  payment_date: string;
  reference_number: string;
  notes: string;
}

interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  reference_number?: string;
  notes?: string;
  created_at: string;
}

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPaymentsListModal, setShowPaymentsListModal] = useState(false);
  const [showPaymentsModal, setShowPaymentsModal] = useState(false);
  const [selectedInvoiceForPayments, setSelectedInvoiceForPayments] = useState<Invoice | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [paymentFormData, setPaymentFormData] = useState({
    amount: '',
    payment_method: 'cash',
    payment_date: new Date().toISOString().split('T')[0],
    reference_number: '',
    notes: ''
  });
  const [paymentForm, setPaymentForm] = useState<PaymentForm>({
    amount: 0,
    payment_method: 'check',
    payment_date: new Date().toISOString().split('T')[0],
    reference_number: '',
    notes: ''
  });
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [formData, setFormData] = useState({
    customer_id: '',
    work_order_id: '',
    invoice_number: '',
    status: 'draft' as const,
    issue_date: new Date().toISOString().split('T')[0],
    due_date: '',
    subtotal: 0,
    tax_rate: 0,
    tax_amount: 0,
    total_amount: 0,
    notes: ''
  });

  useEffect(() => {
    fetchInvoices();
    fetchCustomers();
    fetchWorkOrders();
  }, []);

  const fetchInvoices = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile) return;

      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          customers (
            first_name,
            last_name,
            email,
            phone,
            company_name,
            customer_type
          ),
          work_orders (
            wo_number,
            title
          )
        `)
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Check for overdue invoices and update them
      const today = new Date().toISOString().split('T')[0];
      const overdueInvoices = data?.filter(invoice => 
        invoice.due_date && 
        invoice.due_date < today && 
        invoice.status === 'sent' &&
        invoice.paid_amount < invoice.total_amount
      ) || [];

      // Update overdue invoices
      if (overdueInvoices.length > 0) {
        const { error: updateError } = await supabase
          .from('invoices')
          .update({ status: 'overdue' })
          .in('id', overdueInvoices.map(inv => inv.id));

        if (!updateError) {
          // Reload data to show updated statuses
          fetchInvoices();
          return;
        }
      }

      setInvoices(data || []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile) return;

      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('first_name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchWorkOrders = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile) return;

      const { data, error } = await supabase
        .from('work_orders')
        .select('id, wo_number, title')
        .eq('company_id', profile.company_id)
        .order('wo_number');

      if (error) throw error;
      setWorkOrders(data || []);
    } catch (error) {
      console.error('Error fetching work orders:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile) return;

      const invoiceData = {
        ...formData,
        company_id: profile.company_id,
        tax_amount: (formData.subtotal * formData.tax_rate) / 100,
        total_amount: formData.subtotal + ((formData.subtotal * formData.tax_rate) / 100)
      };

      if (editingInvoice) {
        const { error } = await supabase
          .from('invoices')
          .update(invoiceData)
          .eq('id', editingInvoice.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('invoices')
          .insert([invoiceData]);

        if (error) throw error;
      }

      setShowModal(false);
      setEditingInvoice(null);
      setFormData({
        customer_id: '',
        work_order_id: '',
        invoice_number: '',
        status: 'draft',
        issue_date: new Date().toISOString().split('T')[0],
        due_date: '',
        subtotal: 0,
        tax_rate: 0,
        tax_amount: 0,
        total_amount: 0,
        notes: ''
      });
      fetchInvoices();
    } catch (error) {
      console.error('Error saving invoice:', error);
    }
  };

  const handleEdit = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setFormData({
      customer_id: invoice.customer_id,
      work_order_id: invoice.work_order_id || '',
      invoice_number: invoice.invoice_number,
      status: invoice.status,
      issue_date: invoice.issue_date,
      due_date: invoice.due_date || '',
      subtotal: invoice.subtotal,
      tax_rate: invoice.tax_rate,
      tax_amount: invoice.tax_amount,
      total_amount: invoice.total_amount,
      notes: invoice.notes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this invoice?')) return;

    try {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchInvoices();
    } catch (error) {
      console.error('Error deleting invoice:', error);
    }
  };

  const openPaymentModal = (invoice: Invoice) => {
    const remainingBalance = invoice.total_amount - invoice.paid_amount;
    setPaymentForm({
      amount: remainingBalance,
      payment_method: 'check',
      payment_date: new Date().toISOString().split('T')[0],
      reference_number: '',
      notes: ''
    });
    setSelectedInvoice(invoice);
    setShowPaymentModal(true);
  };

  const openPaymentsModal = async (invoice: Invoice) => {
    setSelectedInvoiceForPayments(invoice);
    await loadPayments(invoice.id);
    setShowPaymentsModal(true);
  };

  const loadPayments = async (invoiceId: string) => {
    try {
      const { data, error } = await supabase
        .from('invoice_payments')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      console.error('Error loading payments:', error);
      setPayments([]);
    }
  };

  const openPaymentsListModal = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    loadPayments(invoice.id);
    setShowPaymentsListModal(true);
  };

  const editPayment = (payment: Payment) => {
    setEditingPayment(payment);
    setPaymentForm({
      amount: payment.amount,
      payment_method: payment.payment_method,
      payment_date: payment.payment_date,
      reference_number: payment.reference_number || '',
      notes: payment.notes || ''
    });
    setShowPaymentModal(true);
  };

  const deletePayment = async (paymentId: string) => {
    if (!confirm('Are you sure you want to delete this payment?')) return;
    if (!selectedInvoiceForPayments) return;

    try {
      const { error } = await supabase
        .from('invoice_payments')
        .delete()
        .eq('id', paymentId);

      if (error) throw error;

      // Recalculate invoice totals
      await recalculateInvoiceTotals(selectedInvoiceForPayments.id);
      
      loadPayments(selectedInvoiceForPayments.id);
      fetchInvoices(); // Refresh main invoice list
    } catch (error) {
      console.error('Error deleting payment:', error);
      alert('Error deleting payment');
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceForPayments) return;

    try {
      const paymentData = {
        invoice_id: selectedInvoiceForPayments.id,
        amount: parseFloat(paymentFormData.amount),
        payment_method: paymentFormData.payment_method,
        payment_date: paymentFormData.payment_date,
        reference_number: paymentFormData.reference_number || null,
        notes: paymentFormData.notes || null
      };

      if (editingPayment) {
        const { error } = await supabase
          .from('invoice_payments')
          .update(paymentData)
          .eq('id', editingPayment.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('invoice_payments')
          .insert([paymentData]);
        if (error) throw error;
      }

      // Recalculate invoice totals
      await recalculateInvoiceTotals(selectedInvoiceForPayments.id);
      
      setShowPaymentForm(false);
      setEditingPayment(null);
      resetPaymentForm();
      loadPayments(selectedInvoiceForPayments.id);
      fetchInvoices(); // Refresh main invoice list
    } catch (error) {
      console.error('Error saving payment:', error);
      alert('Error saving payment');
    }
  };

  const recalculateInvoiceTotals = async (invoiceId: string) => {
    try {
      // Get all payments for this invoice
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('invoice_payments')
        .select('amount')
        .eq('invoice_id', invoiceId);

      if (paymentsError) throw paymentsError;

      const totalPaid = (paymentsData || []).reduce((sum, payment) => sum + payment.amount, 0);
      
      // Get invoice total to determine status
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select('total_amount')
        .eq('id', invoiceId)
        .single();

      if (invoiceError) throw invoiceError;

      // Determine new status
      let newStatus = 'sent';
      if (totalPaid >= invoiceData.total_amount) {
        newStatus = 'paid';
      } else if (totalPaid > 0) {
        newStatus = 'overdue'; // Partial payment
      }

      // Update invoice
      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          paid_amount: totalPaid,
          payment_date: totalPaid >= invoiceData.total_amount ? new Date().toISOString().split('T')[0] : null,
          status: newStatus
        })
        .eq('id', invoiceId);

      if (updateError) throw updateError;
    } catch (error) {
      console.error('Error recalculating invoice totals:', error);
    }
  };

  const resetPaymentForm = () => {
    setPaymentFormData({
      amount: '',
      payment_method: 'cash',
      payment_date: new Date().toISOString().split('T')[0],
      reference_number: '',
      notes: ''
    });
  };

  const startEditPayment = (payment: Payment) => {
    setEditingPayment(payment);
    setPaymentFormData({
      amount: payment.amount.toString(),
      payment_method: payment.payment_method,
      payment_date: payment.payment_date,
      reference_number: payment.reference_number || '',
      notes: payment.notes || ''
    });
    setShowPaymentForm(true);
  };

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedInvoice) return;

    try {
      let newPaidAmount;
      let updatedNotes;

      if (editingPayment) {
        // Update existing payment
        const oldPaymentLine = `Payment: $${editingPayment.amount} via ${editingPayment.payment_method} on ${editingPayment.payment_date}${editingPayment.reference_number ? ` (Ref: ${editingPayment.reference_number})` : ''}${editingPayment.notes ? ` - ${editingPayment.notes}` : ''}`;
        const newPaymentLine = `Payment: $${paymentForm.amount} via ${paymentForm.payment_method} on ${paymentForm.payment_date}${paymentForm.reference_number ? ` (Ref: ${paymentForm.reference_number})` : ''}${paymentForm.notes ? ` - ${paymentForm.notes}` : ''}`;
        
        newPaidAmount = selectedInvoice.paid_amount - editingPayment.amount + paymentForm.amount;
        updatedNotes = selectedInvoice.notes?.replace(oldPaymentLine, newPaymentLine) || newPaymentLine;
      } else {
        // Add new payment
        newPaidAmount = selectedInvoice.paid_amount + paymentForm.amount;
        const newPaymentLine = `Payment: $${paymentForm.amount} via ${paymentForm.payment_method} on ${paymentForm.payment_date}${paymentForm.reference_number ? ` (Ref: ${paymentForm.reference_number})` : ''}${paymentForm.notes ? ` - ${paymentForm.notes}` : ''}`;
        updatedNotes = selectedInvoice.notes ? 
          `${selectedInvoice.notes}\n\n${newPaymentLine}` :
          newPaymentLine;
      }

      const newStatus = newPaidAmount >= selectedInvoice.total_amount ? 'paid' : selectedInvoice.status;
      
      // Update invoice with payment
      const { error } = await supabase
        .from('invoices')
        .update({
          paid_amount: newPaidAmount,
          payment_date: paymentForm.payment_date,
          status: newStatus,
          notes: updatedNotes
        })
        .eq('id', selectedInvoice.id);

      if (error) throw error;

      setShowPaymentModal(false);
      setEditingPayment(null);
      setSelectedInvoice(null);
      setPaymentForm({
        amount: 0,
        payment_method: 'check',
        payment_date: new Date().toISOString().split('T')[0],
        reference_number: '',
        notes: ''
      });
      fetchInvoices();
      if (showPaymentsListModal && selectedInvoice) {
        loadPayments(selectedInvoice.id);
      }
    } catch (error) {
      console.error('Error recording payment:', error);
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = 
      invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${invoice.customers?.first_name} ${invoice.customers?.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customers?.company_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'paid': return 'bg-green-100 text-green-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-600';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Invoice
        </button>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search invoices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Work Order
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {invoice.invoice_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {invoice.customers?.customer_type === 'commercial' && invoice.customers?.company_name
                        ? invoice.customers.company_name
                        : `${invoice.customers?.first_name} ${invoice.customers?.last_name}`
                      }
                    </div>
                    <div className="text-sm text-gray-500">
                      {invoice.customers?.customer_type === 'commercial' 
                        ? `${invoice.customers?.first_name} ${invoice.customers?.last_name}`
                        : invoice.customers?.email
                      }
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {invoice.work_orders ? (
                      <div>
                        <div className="font-medium">{invoice.work_orders.wo_number}</div>
                        <div className="text-gray-500 text-xs">{invoice.work_orders.title}</div>
                      </div>
                    ) : (
                      <span className="text-gray-400">No work order</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {formatCurrency(invoice.total_amount)}
                    </div>
                    {invoice.paid_amount > 0 && (
                      <div className="text-xs text-green-600">
                        Paid: {formatCurrency(invoice.paid_amount)}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(invoice.status)}`}>
                      {invoice.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'No due date'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => setSelectedInvoice(invoice)}
                      className="text-blue-600 hover:text-blue-900"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {invoice.paid_amount > 0 && (
                      <button
                        onClick={() => openPaymentsModal(invoice)}
                        className="text-purple-600 hover:text-purple-800 p-1.5 transition-all duration-200 hover:bg-purple-100 rounded-full hover:shadow-sm transform hover:scale-110"
                        title="Manage Payments"
                      >
                        <DollarSign className="w-4 h-4" />
                      </button>
                    )}
                    {(invoice.status === 'sent' || invoice.status === 'overdue') && invoice.paid_amount < invoice.total_amount && (
                      <button
                        onClick={() => openPaymentModal(invoice)}
                        className="text-green-600 hover:text-green-900"
                        title="Add Payment"
                      >
                        <DollarSign className="w-4 h-4" />
                      </button>
                    )}
                    {invoice.paid_amount > 0 && (
                      <button
                        onClick={() => openPaymentsListModal(invoice)}
                        className="text-purple-600 hover:text-purple-900"
                        title="View Payments"
                      >
                        <CreditCard className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(invoice)}
                      className="text-indigo-600 hover:text-indigo-900"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(invoice.id)}
                      className="text-red-600 hover:text-red-900"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredInvoices.length === 0 && (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No invoices found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search or filter criteria.'
                : 'Get started by creating your first invoice.'
              }
            </p>
          </div>
        )}
      </div>

      {/* Create/Edit Invoice Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                {editingInvoice ? 'Edit Invoice' : 'Create New Invoice'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Customer *
                    </label>
                    <select
                      value={formData.customer_id}
                      onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select Customer</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.customer_type === 'commercial' && customer.company_name
                            ? `${customer.company_name} (${customer.first_name} ${customer.last_name})`
                            : `${customer.first_name} ${customer.last_name}`
                          }
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Work Order
                    </label>
                    <select
                      value={formData.work_order_id}
                      onChange={(e) => setFormData({ ...formData, work_order_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">No work order</option>
                      {workOrders.map((wo) => (
                        <option key={wo.id} value={wo.id}>
                          {wo.wo_number} - {wo.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Invoice Number *
                    </label>
                    <input
                      type="text"
                      value={formData.invoice_number}
                      onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="draft">Draft</option>
                      <option value="sent">Sent</option>
                      <option value="paid">Paid</option>
                      <option value="overdue">Overdue</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Issue Date *
                    </label>
                    <input
                      type="date"
                      value={formData.issue_date}
                      onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Subtotal *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.subtotal}
                      onChange={(e) => {
                        const subtotal = parseFloat(e.target.value) || 0;
                        const taxAmount = (subtotal * formData.tax_rate) / 100;
                        setFormData({ 
                          ...formData, 
                          subtotal,
                          tax_amount: taxAmount,
                          total_amount: subtotal + taxAmount
                        });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tax Rate (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.tax_rate}
                      onChange={(e) => {
                        const taxRate = parseFloat(e.target.value) || 0;
                        const taxAmount = (formData.subtotal * taxRate) / 100;
                        setFormData({ 
                          ...formData, 
                          tax_rate: taxRate,
                          tax_amount: taxAmount,
                          total_amount: formData.subtotal + taxAmount
                        });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tax Amount
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.tax_amount}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Total Amount
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.total_amount}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Additional notes..."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingInvoice(null);
                      setFormData({
                        customer_id: '',
                        work_order_id: '',
                        invoice_number: '',
                        status: 'draft',
                        issue_date: new Date().toISOString().split('T')[0],
                        due_date: '',
                        subtotal: 0,
                        tax_rate: 0,
                        tax_amount: 0,
                        total_amount: 0,
                        notes: ''
                      });
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    {editingInvoice ? 'Update Invoice' : 'Create Invoice'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Record Payment
              </h2>
              
              {editingPayment && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700 font-medium">Editing Payment</p>
                  <p className="text-xs text-blue-600">Original: ${editingPayment.amount} via {editingPayment.payment_method} on {editingPayment.payment_date}</p>
                </div>
              )}
              
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600">Invoice: {selectedInvoice.invoice_number}</div>
                <div className="text-sm text-gray-600">
                  Customer: {selectedInvoice.customers?.customer_type === 'commercial' && selectedInvoice.customers?.company_name
                    ? selectedInvoice.customers.company_name
                    : `${selectedInvoice.customers?.first_name} ${selectedInvoice.customers?.last_name}`
                  }
                </div>
                <div className="text-sm text-gray-600">Total: {formatCurrency(selectedInvoice.total_amount)}</div>
                <div className="text-sm text-gray-600">Paid: {formatCurrency(selectedInvoice.paid_amount)}</div>
                <div className="text-sm font-medium text-gray-900">
                  Balance: {formatCurrency(selectedInvoice.total_amount - selectedInvoice.paid_amount)}
                </div>
              </div>

              <form onSubmit={submitPayment} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Amount *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    max={selectedInvoice.total_amount - selectedInvoice.paid_amount}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Method *
                  </label>
                  <select
                    value={paymentForm.payment_method}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="check">Check</option>
                    <option value="cash">Cash</option>
                    <option value="card">Credit/Debit Card</option>
                    <option value="ach">ACH Transfer</option>
                    <option value="wire">Wire Transfer</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Date *
                  </label>
                  <input
                    type="date"
                    value={paymentForm.payment_date}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reference Number
                  </label>
                  <input
                    type="text"
                    value={paymentForm.reference_number}
                    onChange={(e) => setPaymentForm({ ...paymentForm, reference_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Check number, transaction ID, etc."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Additional payment notes..."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPaymentModal(false);
                      setEditingPayment(null);
                      setSelectedInvoice(null);
                      setPaymentForm({
                        amount: 0,
                        payment_method: 'check',
                        payment_date: new Date().toISOString().split('T')[0],
                        reference_number: '',
                        notes: ''
                      });
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    {editingPayment ? 'Update Payment' : 'Record Payment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Payments List Modal */}
      {showPaymentsListModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Payment History - {selectedInvoice.invoice_number}
                  </h2>
                  <p className="text-sm text-gray-600">
                    Total: {formatCurrency(selectedInvoice.total_amount)} | 
                    Paid: {formatCurrency(selectedInvoice.paid_amount)} | 
                    Balance: {formatCurrency(selectedInvoice.total_amount - selectedInvoice.paid_amount)}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowPaymentsListModal(false);
                    setSelectedInvoice(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {payments.length > 0 ? (
                <div className="space-y-4">
                  {payments.map((payment) => (
                    <div key={payment.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-4 mb-2">
                            <span className="text-lg font-semibold text-gray-900">
                              {formatCurrency(payment.amount)}
                            </span>
                            <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                              {payment.payment_method}
                            </span>
                            <span className="text-sm text-gray-600">
                              {new Date(payment.payment_date).toLocaleDateString()}
                            </span>
                          </div>
                          
                          {payment.reference_number && (
                            <p className="text-sm text-gray-600 mb-1">
                              <span className="font-medium">Reference:</span> {payment.reference_number}
                            </p>
                          )}
                          
                          {payment.notes && (
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Notes:</span> {payment.notes}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex space-x-2 ml-4">
                          <button
                            onClick={() => editPayment(payment)}
                            className="text-blue-600 hover:text-blue-800 p-1"
                            title="Edit Payment"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deletePayment(payment.id)}
                            className="text-red-600 hover:text-red-800 p-1"
                            title="Delete Payment"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <div className="pt-4 border-t border-gray-200">
                    <button
                      onClick={() => {
                        setEditingPayment(null);
                        setPaymentForm({
                          amount: selectedInvoice.total_amount - selectedInvoice.paid_amount,
                          payment_method: 'check',
                          payment_date: new Date().toISOString().split('T')[0],
                          reference_number: '',
                          notes: ''
                        });
                        setShowPaymentModal(true);
                      }}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Add Another Payment
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Payments Found</h3>
                  <p className="text-gray-600 mb-4">No payment history available for this invoice.</p>
                  <button
                    onClick={() => {
                      setEditingPayment(null);
                      setPaymentForm({
                        amount: selectedInvoice.total_amount - selectedInvoice.paid_amount,
                        payment_method: 'check',
                        payment_date: new Date().toISOString().split('T')[0],
                        reference_number: '',
                        notes: ''
                      });
                      setShowPaymentModal(true);
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Add First Payment
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payments Management Modal */}
      {showPaymentsModal && selectedInvoiceForPayments && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    Payment History - {selectedInvoiceForPayments.invoice_number}
                  </h3>
                  <p className="text-sm text-gray-600">
                    Total: ${selectedInvoiceForPayments.total_amount.toFixed(2)} | 
                    Paid: ${selectedInvoiceForPayments.paid_amount.toFixed(2)} | 
                    Balance: ${(selectedInvoiceForPayments.total_amount - selectedInvoiceForPayments.paid_amount).toFixed(2)}
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => {
                      resetPaymentForm();
                      setEditingPayment(null);
                      setShowPaymentForm(true);
                    }}
                    className="inline-flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Payment
                  </button>
                  <button
                    onClick={() => setShowPaymentsModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              {payments.length > 0 ? (
                <div className="space-y-4">
                  {payments.map((payment) => (
                    <div key={payment.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-4">
                            <div>
                              <p className="text-lg font-semibold text-green-600">
                                ${payment.amount.toFixed(2)}
                              </p>
                              <p className="text-sm text-gray-600">
                                {payment.payment_method.charAt(0).toUpperCase() + payment.payment_method.slice(1)}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {new Date(payment.payment_date).toLocaleDateString()}
                              </p>
                              {payment.reference_number && (
                                <p className="text-sm text-gray-600">
                                  Ref: {payment.reference_number}
                                </p>
                              )}
                            </div>
                            {payment.notes && (
                              <div className="flex-1">
                                <p className="text-sm text-gray-600">{payment.notes}</p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => startEditPayment(payment)}
                            className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-100 rounded-lg transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deletePayment(payment.id)}
                            className="text-red-600 hover:text-red-800 p-2 hover:bg-red-100 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No payments recorded</h3>
                  <p className="text-gray-600 mb-4">Add the first payment for this invoice</p>
                  <button
                    onClick={() => {
                      resetPaymentForm();
                      setEditingPayment(null);
                      setShowPaymentForm(true);
                    }}
                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Add First Payment
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Form Modal */}
      {showPaymentForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingPayment ? 'Edit Payment' : 'Add Payment'}
              </h3>
            </div>
            
            <form onSubmit={handlePaymentSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Amount *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={paymentFormData.amount}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Method *
                </label>
                <select
                  value={paymentFormData.payment_method}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, payment_method: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="cash">Cash</option>
                  <option value="check">Check</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="ach">ACH</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Date *
                </label>
                <input
                  type="date"
                  value={paymentFormData.payment_date}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, payment_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reference Number
                </label>
                <input
                  type="text"
                  value={paymentFormData.reference_number}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, reference_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Check #, Transaction ID, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={paymentFormData.notes}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Additional payment notes..."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPaymentForm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  {editingPayment ? 'Update Payment' : 'Add Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Detail Modal */}
      {selectedInvoice && !showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  Invoice {selectedInvoice.invoice_number}
                </h2>
                <div className="flex items-center gap-2">
                  {(selectedInvoice.status === 'sent' || selectedInvoice.status === 'overdue') && 
                   selectedInvoice.paid_amount < selectedInvoice.total_amount && (
                    <button
                      onClick={() => openPaymentModal(selectedInvoice)}
                      className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 flex items-center gap-1"
                    >
                      <DollarSign className="w-3 h-3" />
                      Payment
                    </button>
                  )}
                  {selectedInvoice.paid_amount > 0 && (
                    <button
                      onClick={() => openPaymentsListModal(selectedInvoice)}
                      className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700 flex items-center gap-1"
                    >
                      <CreditCard className="w-3 h-3" />
                      Payments
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedInvoice(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <User className="w-5 h-5" />
                      Customer Information
                    </h3>
                    <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                      <div className="font-medium">
                        {selectedInvoice.customers?.customer_type === 'commercial' && selectedInvoice.customers?.company_name
                          ? selectedInvoice.customers.company_name
                          : `${selectedInvoice.customers?.first_name} ${selectedInvoice.customers?.last_name}`
                        }
                      </div>
                      {selectedInvoice.customers?.customer_type === 'commercial' && (
                        <div className="text-sm text-gray-600">
                          Contact: {selectedInvoice.customers?.first_name} {selectedInvoice.customers?.last_name}
                        </div>
                      )}
                      {selectedInvoice.customers?.email && (
                        <div className="text-sm text-gray-600 flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {selectedInvoice.customers.email}
                        </div>
                      )}
                      {selectedInvoice.customers?.phone && (
                        <div className="text-sm text-gray-600 flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {selectedInvoice.customers.phone}
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedInvoice.work_orders && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Work Order
                      </h3>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="font-medium">{selectedInvoice.work_orders.wo_number}</div>
                        <div className="text-sm text-gray-600">{selectedInvoice.work_orders.title}</div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <Calendar className="w-5 h-5" />
                      Invoice Details
                    </h3>
                    <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Status:</span>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedInvoice.status)}`}>
                          {selectedInvoice.status}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Issue Date:</span>
                        <span>{new Date(selectedInvoice.issue_date).toLocaleDateString()}</span>
                      </div>
                      {selectedInvoice.due_date && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Due Date:</span>
                          <span>{new Date(selectedInvoice.due_date).toLocaleDateString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-600">Subtotal:</span>
                        <span>{formatCurrency(selectedInvoice.subtotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tax ({selectedInvoice.tax_rate}%):</span>
                        <span>{formatCurrency(selectedInvoice.tax_amount)}</span>
                      </div>
                      <div className="flex justify-between font-medium text-lg border-t pt-2">
                        <span>Total:</span>
                        <span>{formatCurrency(selectedInvoice.total_amount)}</span>
                      </div>
                      {selectedInvoice.paid_amount > 0 && (
                        <>
                          <div className="flex justify-between text-green-600">
                            <span>Paid:</span>
                            <span>{formatCurrency(selectedInvoice.paid_amount)}</span>
                          </div>
                          <div className="flex justify-between font-medium">
                            <span>Balance:</span>
                            <span>{formatCurrency(selectedInvoice.total_amount - selectedInvoice.paid_amount)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {selectedInvoice.notes && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Notes</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedInvoice.notes}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}