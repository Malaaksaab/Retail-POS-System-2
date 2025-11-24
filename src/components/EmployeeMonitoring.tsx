import React from 'react';
import { Users, AlertTriangle, Search, Filter, Download, Loader2 } from 'lucide-react';
import { User, Store } from '../types';
import { hasPermission, PERMISSIONS } from '../utils/permissions';
import { useEmployeePerformance } from '../hooks/useRealtimeData';

interface EmployeeMonitoringProps { user: User; stores: Store[]; }

export const EmployeeMonitoring: React.FC<EmployeeMonitoringProps> = ({ user, stores }) => {
  const { data: employees, loading } = useEmployeePerformance();
  const [searchTerm, setSearchTerm] = React.useState('');

  const canView = hasPermission(user, PERMISSIONS.USERS_VIEW);
  
  if (!canView) {
    return (
      <div className="flex items-center justify-center h-96 text-center">
        <div>
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900">Access Denied</h3>
          <p className="text-gray-500">You do not have permission to view employee analytics.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  const filtered = employees.filter(e => e.employeeName?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employee Analytics</h1>
          <p className="text-gray-600">Performance tracking and metrics</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search employees..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Download className="w-4 h-4 mr-2" /> Export
          </button>
        </div>
      </div>
      
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No Employee Data Found</h3>
          <p className="text-gray-500">Performance metrics will appear here once transactions are recorded.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {filtered.map((emp) => (
             <div key={emp.id} className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-xl text-gray-900">{emp.employeeName}</h3>
                    <p className="text-gray-500 capitalize">{emp.role}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${emp.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {emp.status}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                   <div className="bg-green-50 p-3 rounded-lg">
                      <div className="text-xs text-gray-600 uppercase font-semibold mb-1">Monthly Sales</div>
                      <div className="font-bold text-green-700 text-lg">£{emp.monthlyStats?.totalSales?.toLocaleString() || '0'}</div>
                   </div>
                   <div className="bg-blue-50 p-3 rounded-lg">
                      <div className="text-xs text-gray-600 uppercase font-semibold mb-1">Transactions</div>
                      <div className="font-bold text-blue-700 text-lg">{emp.monthlyStats?.totalTransactions || 0}</div>
                   </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Efficiency Score</span>
                    <span className="font-medium">{emp.monthlyStats?.performanceScore || 0}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${emp.monthlyStats?.performanceScore || 0}%` }}
                    ></div>
                  </div>
                </div>
             </div>
          ))}
        </div>
      )}
    </div>
  );
};