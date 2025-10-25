import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useCreateManualPayment, type ManualPaymentRequest } from '@/hooks/usePayments';
import { useClients } from '@/hooks';

interface AddPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AddPaymentModal: React.FC<AddPaymentModalProps> = ({ isOpen, onClose }) => {
  const { data: clients } = useClients();
  const createPayment = useCreateManualPayment();
  
  const [formData, setFormData] = useState<ManualPaymentRequest>({
    client_id: 0,
    amount: 150,
    currency: 'ILS',
    plan_name: '',
    duration_months: 1,
    status: 'PAID',
    notes: ''
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.client_id || !formData.plan_name) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      await createPayment.mutateAsync(formData);
      
      // Show success message
      alert('Payment added successfully!');
      
      onClose();
      // Reset form
      setFormData({
        client_id: 0,
        amount: 150,
        currency: 'ILS',
        plan_name: '',
        duration_months: 1,
        status: 'PAID',
        notes: ''
      });
    } catch (error) {
      console.error('Failed to create payment:', error);
      alert('Failed to create payment. Please try again.');
    }
  };

  const handleInputChange = (field: keyof ManualPaymentRequest, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const modalContent = (
    <div 
      className="fixed bg-white rounded-lg shadow-2xl"
      style={{ 
        position: 'fixed', 
        top: '50%', 
        left: '50%', 
        transform: 'translate(-50%, -50%)',
        zIndex: 9999,
        width: '500px',
        maxHeight: '80vh',
        backgroundColor: '#ffffff',
        border: '3px solid #374151',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}
    >
      <div className="p-6 overflow-y-auto max-h-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Add Manual Payment</h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Client Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Client <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.client_id}
              onChange={(e) => handleInputChange('client_id', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A90E2] focus:border-transparent"
              required
            >
              <option value={0}>Select a client</option>
              {clients?.map((client: any) => (
                <option key={client.id} value={client.id}>
                  {client.username} ({client.email})
                </option>
              ))}
            </select>
          </div>

          {/* Plan Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Payment Description <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.plan_name}
              onChange={(e) => handleInputChange('plan_name', e.target.value)}
              placeholder="e.g., Monthly Personal Training, Cash Payment"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A90E2] focus:border-transparent"
              required
            />
          </div>

          {/* Amount and Currency */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Amount <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => handleInputChange('amount', parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A90E2] focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Currency</label>
              <select
                value={formData.currency}
                onChange={(e) => handleInputChange('currency', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A90E2] focus:border-transparent"
              >
                <option value="ILS">ILS (₪)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>
          </div>

          {/* Duration and Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Duration (Months)</label>
              <input
                type="number"
                min="1"
                value={formData.duration_months}
                onChange={(e) => handleInputChange('duration_months', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A90E2] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
              <select
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value as 'INITIATED' | 'PAID' | 'FAILED')}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A90E2] focus:border-transparent"
              >
                <option value="PAID">Paid</option>
                <option value="INITIATED">Pending</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Notes (Optional)</label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Additional details about this payment..."
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A90E2] focus:border-transparent resize-none"
            />
          </div>

          {/* Error Display */}
          {createPayment.isError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              Failed to create payment. Please check your input and try again.
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createPayment.isPending}
              className="flex-1 px-4 py-2 bg-[#4A90E2] text-white rounded-lg hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-[#4A90E2] disabled:opacity-50"
            >
              {createPayment.isPending ? 'Creating...' : 'Create Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default AddPaymentModal;