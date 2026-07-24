"use client";

import { Search, Download, Filter } from "lucide-react";

interface OrderFiltersProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  channel: string;
  setChannel: (val: string) => void;
  paymentStatus: string;
  setPaymentStatus: (val: string) => void;
  dateFilter: string;
  setDateFilter: (val: string) => void;
  onExport: () => void;
}

export function OrderFilters({
  searchQuery, setSearchQuery,
  channel, setChannel,
  paymentStatus, setPaymentStatus,
  dateFilter, setDateFilter,
  onExport
}: OrderFiltersProps) {
  return (
    <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 flex flex-col md:flex-row gap-3 items-center justify-between z-10 relative">
      
      {/* Search Input */}
      <div className="relative w-full md:w-1/3">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input 
          type="text"
          placeholder="Cari ID / Nama Pelanggan..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-11 pl-10 pr-4 rounded-2xl bg-slate-50 border border-slate-100 text-sm font-medium focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary focus:bg-white transition-colors"
        />
      </div>

      {/* Dropdown Filters */}
      <div className="flex w-full md:w-auto gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
        <div className="flex items-center gap-2 px-3 h-11 rounded-2xl bg-slate-50 border border-slate-100 shrink-0">
          <Filter size={14} className="text-slate-400" />
          <select 
            value={dateFilter} 
            onChange={(e) => setDateFilter(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-600 focus:outline-none cursor-pointer"
          >
            <option value="all">Semua Waktu</option>
            <option value="today">Hari Ini</option>
            <option value="yesterday">Kemarin</option>
            <option value="7days">7 Hari Terakhir</option>
            <option value="30days">30 Hari Terakhir</option>
          </select>
        </div>

        <div className="flex items-center gap-2 px-3 h-11 rounded-2xl bg-slate-50 border border-slate-100 shrink-0">
          <select 
            value={channel} 
            onChange={(e) => setChannel(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-600 focus:outline-none cursor-pointer"
          >
            <option value="all">Semua Channel</option>
            <option value="walkin">Walk-in</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="tiktok">TikTok</option>
            <option value="shopee">Shopee</option>
          </select>
        </div>

        <div className="flex items-center gap-2 px-3 h-11 rounded-2xl bg-slate-50 border border-slate-100 shrink-0">
          <select 
            value={paymentStatus} 
            onChange={(e) => setPaymentStatus(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-600 focus:outline-none cursor-pointer"
          >
            <option value="all">Semua Bayar</option>
            <option value="sudah_bayar">Lunas</option>
            <option value="belum_bayar">Belum Lunas</option>
          </select>
        </div>

        {/* Export Button */}
        <button 
          onClick={onExport}
          className="ml-auto md:ml-2 shrink-0 h-11 px-4 flex items-center gap-2 rounded-2xl bg-green-50 text-green-600 font-bold text-xs hover:bg-green-100 transition-colors tap-target border border-green-200/50"
        >
          <Download size={14} /> Export
        </button>
      </div>

    </div>
  );
}
