// ============================================================
// Requests Page — CRUD with modal form, filters, table
// ============================================================

import { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Filter,
  ClipboardList,
} from 'lucide-react';
import {
  Button,
  Card,
  Badge,
  Modal,
  InputField,
  SelectField,
  TextareaField,
  ConfirmDialog,
  EmptyState,
  Skeleton,
} from '../../components/ui';
import { useRequests, useCreateRequest, useUpdateRequest, useDeleteRequest, useSections } from '../../api/maintenanceHooks';
import { useToast } from '../../hooks/useToast';
import { DEPARTMENTS, SEVERITIES, SEVERITY_BADGE_CLASSES, STATUS_BADGE_CLASSES, DEPARTMENT_BADGE_CLASSES } from '../../lib/constants';
import { formatDuration } from '../../lib/utils';
import type { MaintenanceRequest, CreateRequestPayload, Department, Severity } from '../../lib/types';
import type { StationNode, TrackEdge } from '../../lib/corridorTypes';

interface RequestsProps {
  nodes?: StationNode[];
  edges?: TrackEdge[];
  selectedCorridor?: string;
}

export default function Requests({ nodes, edges, selectedCorridor }: RequestsProps) {
  const { data: requests, isLoading } = useRequests();
  const { data: sections } = useSections();
  const createRequest = useCreateRequest();
  const updateRequest = useUpdateRequest();
  const deleteRequest = useDeleteRequest();
  const { addToast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<MaintenanceRequest | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');

  const edgeOptions = useMemo(() => {
    if (!edges || !nodes) return [];
    return edges
      .filter(e => e.direction === 'UP')
      .map(edge => {
        const s = nodes.find(n => n.id === edge.source)?.code || edge.source;
        const t = nodes.find(n => n.id === edge.target)?.code || edge.target;
        return `${s} ➔ ${t}`;
      });
  }, [edges, nodes]);

  const activeSectionName = useMemo(() => {
    if (!sections || !selectedCorridor) return '';
    const [source] = selectedCorridor.split('-');
    const match = sections.find(s => s.name.toLowerCase().includes(source.toLowerCase()));
    return match ? match.name : sections[0]?.name;
  }, [sections, selectedCorridor]);

  // Form state
  const [form, setForm] = useState<CreateRequestPayload & { place?: string }>({
    section: '',
    place: '',
    department: 'Engineering',
    description: '',
    duration: 60,
    severity: 'medium',
    overdueDays: 0,
  });

  const resetForm = () => {
    setForm({
      section: activeSectionName,
      place: edgeOptions.length > 0 ? edgeOptions[0] : '',
      department: 'Engineering',
      description: '',
      duration: 60,
      severity: 'medium',
      overdueDays: 0,
    });
    setEditingRequest(null);
  };

  const openCreate = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (req: MaintenanceRequest) => {
    setEditingRequest(req);
    
    // Parse place if formatted as [Place] description
    let place = '';
    let description = req.description;
    const match = req.description.match(/^\[(.*?)\]\s*(.*)$/);
    if (match) {
      place = match[1];
      description = match[2];
    }
    
    setForm({
      section: req.section,
      place,
      department: req.department,
      description,
      duration: req.duration,
      severity: req.severity,
      overdueDays: req.overdueDays,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const submitData = {
        ...form,
        description: form.place ? `[${form.place}] ${form.description}` : form.description,
      };
      delete submitData.place;
      
      if (editingRequest) {
        await updateRequest.mutateAsync({ id: editingRequest.id, ...submitData });
        addToast('success', 'Request updated successfully');
      } else {
        await createRequest.mutateAsync(submitData as CreateRequestPayload);
        addToast('success', 'Request created successfully');
      }
      setModalOpen(false);
      resetForm();
    } catch {
      addToast('error', 'Failed to save request');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteRequest.mutateAsync(deleteConfirm);
      addToast('success', 'Request deleted');
      setDeleteConfirm(null);
    } catch {
      addToast('error', 'Failed to delete request');
    }
  };

  const filteredRequests = useMemo(() => {
    if (!requests) return [];
    return requests.filter(r => {
      // Filter out requests that do not belong to the currently selected corridor
      if (nodes && nodes.length > 0) {
        // A request's section name (e.g. "New Delhi - Agra") must match at least one node in the current corridor
        const belongsToCorridor = nodes.some(n => 
          r.section.toLowerCase().includes(n.name.toLowerCase()) || 
          r.section.toLowerCase().includes(n.code.toLowerCase())
        );
        if (!belongsToCorridor) return false;
      }

      if (search && !r.description.toLowerCase().includes(search.toLowerCase()) && !r.section.toLowerCase().includes(search.toLowerCase()) && !r.id.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterDept && r.department !== filterDept) return false;
      if (filterSeverity && r.severity !== filterSeverity) return false;
      return true;
    });
  }, [requests, search, filterDept, filterSeverity]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full max-w-md" />
        <Card className="p-0">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-4 p-4 border-b border-slate-100 dark:border-slate-800">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-40 flex-1" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 max-w-xl w-full">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search requests..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-railway-500/40"
            />
          </div>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={openCreate}>
          New Request
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-slate-400" />
        <select
          value={filterDept}
          onChange={e => setFilterDept(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
        >
          <option value="">All Departments</option>
          {DEPARTMENTS.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select
          value={filterSeverity}
          onChange={e => setFilterSeverity(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
        >
          <option value="">All Severities</option>
          {SEVERITIES.map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        {(filterDept || filterSeverity || search) && (
          <button
            onClick={() => { setFilterDept(''); setFilterSeverity(''); setSearch(''); }}
            className="text-xs text-railway-600 dark:text-railway-400 hover:underline"
          >
            Clear filters
          </button>
        )}
        <span className="text-xs text-slate-400 ml-auto">
          {filteredRequests.length} of {requests?.length || 0} requests
        </span>
      </div>

      {/* Table */}
      {filteredRequests.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="w-8 h-8" />}
          title="No requests found"
          description="Create a new maintenance request or adjust your filters."
          action={
            <Button icon={<Plus className="w-4 h-4" />} onClick={openCreate}>
              Create Request
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">ID</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Section</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Department</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Duration</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Severity</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map(req => (
                  <tr
                    key={req.id}
                    className={`border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${
                      req.severity === 'critical' ? 'bg-red-50/30 dark:bg-red-500/5' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                      {req.id}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-700 dark:text-slate-300 text-xs">{req.section}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={DEPARTMENT_BADGE_CLASSES[req.department]}>{req.department}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {formatDuration(req.duration)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={SEVERITY_BADGE_CLASSES[req.severity]}>
                        {req.severity === 'critical' && '● '}
                        {req.severity}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={STATUS_BADGE_CLASSES[req.status]}>{req.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(req)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(req.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); resetForm(); }}
        title={editingRequest ? 'Edit Request' : 'New Maintenance Request'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <SelectField
              label="Section"
              value={form.section}
              onChange={e => {
                const section = e.target.value;
                setForm(f => ({ ...f, section, place: '' }));
              }}
              options={
                activeSectionName
                  ? [{ value: activeSectionName, label: activeSectionName }]
                  : sections?.map(s => ({ value: s.name, label: s.name })) || []
              }
              required
            />
            <SelectField
              label="Sector"
              value={form.place || ''}
              onChange={e => setForm(f => ({ ...f, place: e.target.value }))}
              options={edgeOptions.map(s => ({ value: s, label: s }))}
              required
            />
            <SelectField
              label="Department"
              value={form.department}
              onChange={e => setForm(f => ({ ...f, department: e.target.value as Department }))}
              options={DEPARTMENTS.map(d => ({ value: d, label: d }))}
              required
            />
          </div>

          <TextareaField
            label="Description"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Describe the maintenance work required..."
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <InputField
              label="Duration (minutes)"
              type="number"
              value={form.duration}
              onChange={e => setForm(f => ({ ...f, duration: Number(e.target.value) }))}
              min={15}
              max={480}
              required
            />
            <SelectField
              label="Severity"
              value={form.severity}
              onChange={e => setForm(f => ({ ...f, severity: e.target.value as Severity }))}
              options={SEVERITIES.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))}
              required
            />
            <InputField
              label="Overdue Days"
              type="number"
              value={form.overdueDays}
              onChange={e => setForm(f => ({ ...f, overdueDays: Number(e.target.value) }))}
              min={0}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <Button variant="secondary" type="button" onClick={() => { setModalOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button type="submit" loading={createRequest.isPending || updateRequest.isPending}>
              {editingRequest ? 'Update Request' : 'Create Request'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Delete Request"
        message="Are you sure you want to delete this maintenance request? This action cannot be undone."
        loading={deleteRequest.isPending}
      />
    </div>
  );
}
