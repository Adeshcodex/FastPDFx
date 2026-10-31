import React, { useState } from 'react';
import { Mail, MessageSquare, Send, Check, AlertCircle } from 'lucide-react';
import { PageMeta } from '../components/PageMeta';

export const ContactPage: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [submittedAction, setSubmittedAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      setError('Please complete all required fields before sending.');
      return;
    }

    const subjectEncoded = encodeURIComponent(`FastPDFx Inquiry: ${formData.subject || 'General'}`);
    const bodyEncoded = encodeURIComponent(
      `Name: ${formData.name}\nEmail: ${formData.email}\n\nMessage:\n${formData.message}`
    );
    const mailtoUrl = `mailto:contact@fastpdfx.com?subject=${subjectEncoded}&body=${bodyEncoded}`;

    window.location.href = mailtoUrl;
    setSubmittedAction(
      'Your email client has opened with your inquiry pre-filled. You can review and send it directly.'
    );
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      <PageMeta
        title="Contact - FastPDFx"
        description="Get in touch with the FastPDFx team for inquiries, bug reports, or feature suggestions."
      />

      <div>
        <div className="text-[10px] font-mono tracking-widest text-[#68735B] uppercase mb-2">
          CONTACT
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-[#20201D] tracking-tight">
          Get in touch with us.
        </h1>
        <p className="mt-2 text-xs sm:text-sm text-[#77766F] leading-relaxed max-w-lg">
          Have feedback on upcoming tools, questions about file privacy, or a feature request? Send us a message.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Contact Info */}
        <div className="space-y-4">
          <div className="bg-white rounded-[2px] border border-[#DEDCD3] p-5">
            <div className="w-8 h-8 rounded-[2px] bg-[#F5F3ED] text-[#20201D] flex items-center justify-center mb-3 border border-[#DEDCD3]">
              <Mail className="w-4 h-4 text-[#68735B]" />
            </div>
            <h3 className="text-xs font-semibold text-[#20201D]">Direct Email</h3>
            <p className="text-[11px] text-[#77766F] mt-1">For general communication:</p>
            <a
              href="mailto:contact@fastpdfx.com"
              className="mt-2 block text-xs font-mono text-[#20201D] hover:text-[#68735B] underline"
            >
              contact@fastpdfx.com
            </a>
          </div>

          <div className="bg-white rounded-[2px] border border-[#DEDCD3] p-5">
            <div className="w-8 h-8 rounded-[2px] bg-[#F5F3ED] text-[#20201D] flex items-center justify-center mb-3 border border-[#DEDCD3]">
              <MessageSquare className="w-4 h-4 text-[#68735B]" />
            </div>
            <h3 className="text-xs font-semibold text-[#20201D]">Feature Input</h3>
            <p className="text-[11px] text-[#77766F] mt-1 leading-relaxed">
              Let us know which PDF or image capabilities are most critical to your workflow for Phase 3.
            </p>
          </div>
        </div>

        {/* Message Form */}
        <div className="md:col-span-2 bg-white rounded-[2px] border border-[#DEDCD3] p-6 sm:p-8">
          <h2 className="text-sm font-mono uppercase tracking-wider font-semibold text-[#20201D] mb-5">
            Send Message
          </h2>

          {submittedAction ? (
            <div className="bg-[#F5F3ED] border border-[#DEDCD3] rounded-[2px] p-5 text-[#20201D]">
              <div className="flex items-start gap-3">
                <Check className="w-4 h-4 text-[#68735B] shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-xs text-[#20201D]">Email Client Triggered</h3>
                  <p className="text-xs text-[#77766F] mt-1 leading-relaxed">
                    {submittedAction}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSubmittedAction(null);
                      setFormData({ name: '', email: '', subject: '', message: '' });
                    }}
                    className="mt-3 text-xs font-medium text-[#20201D] bg-white px-3 py-1 rounded-[2px] border border-[#DEDCD3] hover:border-[#20201D]"
                  >
                    Send another note
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-[#F5F3ED] border border-[#20201D] rounded-[2px] p-3 text-xs text-[#20201D] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-[#68735B]" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name" className="block text-[10px] font-mono uppercase tracking-wider text-[#77766F] mb-1">
                    Your Name *
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Jane Doe"
                    className="w-full px-3 py-2 bg-white rounded-[2px] border border-[#DEDCD3] text-[#20201D] text-xs focus:outline-none focus:border-[#20201D]"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-[10px] font-mono uppercase tracking-wider text-[#77766F] mb-1">
                    Your Email *
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="jane@example.com"
                    className="w-full px-3 py-2 bg-white rounded-[2px] border border-[#DEDCD3] text-[#20201D] text-xs focus:outline-none focus:border-[#20201D]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="subject" className="block text-[10px] font-mono uppercase tracking-wider text-[#77766F] mb-1">
                  Subject
                </label>
                <input
                  id="subject"
                  type="text"
                  value={formData.subject}
                  onChange={e => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="Inquiry or suggestion"
                  className="w-full px-3 py-2 bg-white rounded-[2px] border border-[#DEDCD3] text-[#20201D] text-xs focus:outline-none focus:border-[#20201D]"
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-[10px] font-mono uppercase tracking-wider text-[#77766F] mb-1">
                  Message *
                </label>
                <textarea
                  id="message"
                  rows={4}
                  required
                  value={formData.message}
                  onChange={e => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Write your note here..."
                  className="w-full px-3 py-2 bg-white rounded-[2px] border border-[#DEDCD3] text-[#20201D] text-xs focus:outline-none focus:border-[#20201D]"
                />
              </div>

              <div className="pt-1">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#20201D] text-[#F5F3ED] rounded-[2px] font-medium text-xs hover:bg-[#33322E] transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Message</span>
                </button>
                <p className="mt-2 text-[10px] text-[#77766F] font-mono">
                  Opens your standard email client with your message pre-filled.
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
