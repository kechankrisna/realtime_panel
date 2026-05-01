import { useState, useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    flexRender,
    createColumnHelper,
} from '@tanstack/react-table';
import api from '@/lib/axios';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/useToast';
import { Plus, Pencil, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

function CreateDialog() {
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ name: '', email: '', password: '', is_active: true, is_admin: false });
    const [errors, setErrors] = useState({});
    const qc = useQueryClient();

    const mutation = useMutation({
        mutationFn: (data) => api.post('/users', data),
        onSuccess: () => {
            setOpen(false);
            setForm({ name: '', email: '', password: '', is_active: true, is_admin: false });
            qc.invalidateQueries({ queryKey: ['users'] });
            toast({ title: 'User created successfully!', variant: 'success' });
        },
        onError: (err) => {
            if (err.response?.status === 422) setErrors(err.response.data.errors ?? {});
        },
    });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-1 h-4 w-4" />New User</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader><DialogTitle>Create User</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                    {[['Name', 'name', 'text'], ['Email', 'email', 'email'], ['Password', 'password', 'password']].map(([label, field, type]) => (
                        <div key={field} className="space-y-2">
                            <Label htmlFor={`create-user-${field}`}>{label}</Label>
                            <Input id={`create-user-${field}`} aria-label={label} type={type} value={form[field]} onChange={(e) => setForm({ ...form, [field]: e.target.value })} required={field !== 'password' || form.password.length > 0} />
                            {errors[field] && <p className="text-xs text-destructive">{errors[field][0]}</p>}
                        </div>
                    ))}
                    <div className="flex gap-6">
                        <div className="flex items-center gap-2">
                            <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} id="c-active" />
                            <Label htmlFor="c-active">Active</Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch checked={form.is_admin} onCheckedChange={(v) => setForm({ ...form, is_admin: v })} id="c-admin" />
                            <Label htmlFor="c-admin">Admin</Label>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={() => { setErrors({}); mutation.mutate(form); }} disabled={mutation.isPending}>
                        {mutation.isPending ? 'Creating...' : 'Create'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

const columnHelper = createColumnHelper();

function SortIcon({ column }) {
    if (!column.getCanSort()) return null;
    if (column.getIsSorted() === 'asc') return <ArrowUp className="ml-1 inline h-3 w-3" />;
    if (column.getIsSorted() === 'desc') return <ArrowDown className="ml-1 inline h-3 w-3" />;
    return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-40" />;
}

export default function UsersPage() {
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [sorting, setSorting] = useState([]);

    const { data, isLoading } = useQuery({
        queryKey: ['users', search, page],
        queryFn: () => api.get('/users', { params: { search: search || undefined, page } }).then((r) => r.data),
    });

    const users = data?.data ?? [];

    const columns = useMemo(() => [
        columnHelper.accessor('name', {
            header: 'Name',
            cell: (info) => <span className="font-medium">{info.getValue()}</span>,
        }),
        columnHelper.accessor('email', {
            header: 'Email',
            cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
        }),
        columnHelper.accessor('is_active', {
            header: 'Active',
            cell: (info) => (
                <Badge variant={info.getValue() ? 'success' : 'warning'}>
                    {info.getValue() ? 'Active' : 'Inactive'}
                </Badge>
            ),
        }),
        columnHelper.accessor('is_admin', {
            header: 'Admin',
            cell: (info) => (
                <Badge variant={info.getValue() ? 'default' : 'secondary'}>
                    {info.getValue() ? 'Admin' : 'User'}
                </Badge>
            ),
        }),
        columnHelper.accessor((row) => row.creator?.name ?? '—', {
            id: 'creator',
            header: 'Creator',
            cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
            enableSorting: false,
        }),
        columnHelper.accessor('created_at', {
            header: 'Created',
            cell: (info) => <span className="text-muted-foreground">{new Date(info.getValue()).toLocaleDateString()}</span>,
        }),
        columnHelper.display({
            id: 'actions',
            header: '',
            cell: ({ row }) => (
                <Button variant="outline" size="sm" asChild>
                    <Link to={`/users/${row.original.id}/edit`}><Pencil className="h-3 w-3" /></Link>
                </Button>
            ),
        }),
    ], []);

    const table = useReactTable({
        data: users,
        columns,
        state: { sorting },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        manualPagination: true,
        pageCount: data?.last_page ?? -1,
    });

    return (
        <AppLayout>
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">Users</h1>
                    <CreateDialog />
                </div>
                <Input
                    placeholder="Search by name or email…"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    className="sm:w-64"
                />

                <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                        <thead className="border-b bg-muted/50">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <tr key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <th
                                            key={header.id}
                                            className="px-4 py-3 text-left font-medium text-muted-foreground"
                                        >
                                            {header.isPlaceholder ? null : (
                                                <span
                                                    className={header.column.getCanSort() ? 'cursor-pointer select-none' : ''}
                                                    onClick={header.column.getToggleSortingHandler()}
                                                >
                                                    {flexRender(header.column.columnDef.header, header.getContext())}
                                                    <SortIcon column={header.column} />
                                                </span>
                                            )}
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody className="divide-y">
                            {isLoading ? (
                                <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
                            ) : table.getRowModel().rows.length === 0 ? (
                                <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">No users found.</td></tr>
                            ) : table.getRowModel().rows.map((row) => (
                                <tr key={row.id} className="hover:bg-muted/30">
                                    {row.getVisibleCells().map((cell) => (
                                        <td key={cell.id} className="px-4 py-3">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {data && data.last_page > 1 && (
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>Page {data.current_page} of {data.last_page} ({data.total} users)</span>
                        <div className="flex gap-1">
                            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" disabled={page === data.last_page} onClick={() => setPage(p => p + 1)}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
