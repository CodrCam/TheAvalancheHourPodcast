import { useEffect, useMemo, useRef, useState } from 'react';
import Drawer from '@mui/material/Drawer';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CloudDoneRoundedIcon from '@mui/icons-material/CloudDoneRounded';
import CloudOffRoundedIcon from '@mui/icons-material/CloudOffRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import AdminLayout from '../../components/AdminLayout';
import {
  getAllCatalogSkuEntries,
  getSkuCatalog,
} from '../../lib/productCatalog';
import ui from '../../styles/AdminPeople.module.css';
import styles from '../../styles/AdminInventory.module.css';

const catalogEntries = getAllCatalogSkuEntries();
const catalogMap = getSkuCatalog();

function normalizeRow(row = {}) {
  const sku = String(row.sku || row.sku_key || '').trim();
  return {
    sku,
    name: String(row.name || row.product_name || '').trim(),
    hidden: row.hidden === true || row.hidden === 'true',
    quantity: Math.max(0, Number(row.quantity) || 0),
    updated_at: row.updated_at || null,
  };
}

function getStatus(row) {
  if (!row.inCatalog) {
    return { id: 'unused', label: 'Custom SKU', className: styles.statusUnused };
  }
  if (row.missingInventoryRow) {
    return { id: 'missing', label: 'Needs setup', className: styles.statusMissing };
  }
  if (row.hidden) {
    return { id: 'standby', label: 'Standby', className: styles.statusStandby };
  }
  if (row.quantity <= 0) {
    return { id: 'sold-out', label: 'Sold out', className: styles.statusSoldOut };
  }
  if (row.quantity <= 2) {
    return { id: 'low', label: 'Low stock', className: styles.statusLow };
  }
  return { id: 'in-stock', label: 'In stock', className: styles.statusInStock };
}

function getStatusSortRank(row) {
  return {
    missing: 0,
    'sold-out': 0,
    low: 1,
    'in-stock': 2,
    standby: 3,
    unused: 4,
  }[getStatus(row).id] ?? 5;
}

function StatusBadge({ row }) {
  const status = getStatus(row);
  return (
    <span className={`${styles.statusBadge} ${status.className}`}>
      {status.label}
    </span>
  );
}

function Field({ label, htmlFor, hint, required = false, children }) {
  return (
    <div className={ui.field}>
      <label htmlFor={htmlFor} className={ui.fieldLabel}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {children}
      {hint ? <span className={ui.fieldHint}>{hint}</span> : null}
    </div>
  );
}

function formatUpdatedAt(value) {
  if (!value) return 'Not saved yet';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Recently updated'
    : date.toLocaleString();
}

export default function AdminInventoryPage() {
  const [rows, setRows] = useState([]);
  const [configured, setConfigured] = useState(false);
  const [canUpdate, setCanUpdate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingSku, setSavingSku] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState({});
  const [pendingNames, setPendingNames] = useState({});
  const [customSku, setCustomSku] = useState('');
  const [newName, setNewName] = useState('');
  const [newQty, setNewQty] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [addCloseConfirm, setAddCloseConfirm] = useState(false);
  const [removeArmedSku, setRemoveArmedSku] = useState('');
  const [query, setQuery] = useState('');
  const [productFilter, setProductFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortMode, setSortMode] = useState('status');
  const pageErrorRef = useRef(null);
  const drawerErrorRef = useRef(null);

  const canManage = configured && canUpdate;
  const addDirty = Boolean(customSku.trim() || newName.trim() || newQty !== '');

  async function refresh() {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/store/admin/stock', {
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || 'Failed to load inventory.');
      }

      const list = Array.isArray(data.inventory)
        ? data.inventory
        : Array.isArray(data.stock)
          ? data.stock
          : [];
      setRows(list.map(normalizeRow));
      setConfigured(data.configured === true);
      setCanUpdate(data.canUpdate === true);
      setPending({});
      setPendingNames({});
    } catch (err) {
      setError(err.message || 'Failed to load inventory.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!error) return;
    const target = addOpen ? drawerErrorRef.current : pageErrorRef.current;
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: 'center' });
  }, [addOpen, error]);

  const mergedRows = useMemo(() => {
    const bySku = new Map();

    for (const entry of catalogEntries) {
      bySku.set(entry.sku, {
        sku: entry.sku,
        name: '',
        hidden: false,
        quantity: 0,
        updated_at: null,
        label: entry.label,
        productName: entry.productName,
        inCatalog: true,
        missingInventoryRow: true,
      });
    }

    for (const row of rows) {
      const catalogEntry = catalogMap.get(row.sku);
      bySku.set(row.sku, {
        ...row,
        label: catalogEntry?.label || row.name || '',
        productName: catalogEntry?.productName || '',
        inCatalog: !!catalogEntry,
        missingInventoryRow: false,
      });
    }

    return [...bySku.values()];
  }, [rows]);

  const productOptions = useMemo(() => {
    const names = new Set();
    for (const row of mergedRows) {
      if (row.inCatalog && row.productName) names.add(row.productName);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [mergedRows]);

  const filteredRows = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    return mergedRows
      .filter((row) => {
        const status = getStatus(row).id;
        const searchable = [
          row.sku,
          row.label,
          row.name,
          row.productName,
          getStatus(row).label,
        ]
          .join(' ')
          .toLowerCase();
        const matchesProduct =
          productFilter === 'all' ||
          (productFilter === '__unused' && !row.inCatalog) ||
          row.productName === productFilter;
        const matchesStatus =
          statusFilter === 'all' ||
          status === statusFilter ||
          (statusFilter === 'sold-out' && status === 'missing');

        return (
          (!cleanQuery || searchable.includes(cleanQuery)) &&
          matchesProduct &&
          matchesStatus
        );
      })
      .sort((left, right) => {
        if (sortMode === 'product') {
          const byProduct = String(
            left.productName || left.name || left.label || ''
          ).localeCompare(
            String(right.productName || right.name || right.label || '')
          );
          if (byProduct) return byProduct;
        }
        if (sortMode === 'quantity-desc' && left.quantity !== right.quantity) {
          return right.quantity - left.quantity;
        }
        if (sortMode === 'quantity-asc' && left.quantity !== right.quantity) {
          return left.quantity - right.quantity;
        }
        if (sortMode === 'status') {
          const byStatus =
            getStatusSortRank(left) - getStatusSortRank(right);
          if (byStatus) return byStatus;
        }
        return left.sku.localeCompare(right.sku);
      });
  }, [mergedRows, productFilter, query, sortMode, statusFilter]);

  const summary = useMemo(() => {
    const catalogRows = mergedRows.filter((row) => row.inCatalog);
    const soldOut = catalogRows.filter(
      (row) => !row.hidden && row.quantity <= 0
    ).length;
    const low = catalogRows.filter(
      (row) => !row.hidden && row.quantity > 0 && row.quantity <= 2
    ).length;

    return {
      catalog: catalogRows.length,
      units: catalogRows.reduce((total, row) => total + row.quantity, 0),
      attention: soldOut + low,
      standby: catalogRows.filter((row) => row.hidden).length,
      custom: mergedRows.filter((row) => !row.inCatalog).length,
    };
  }, [mergedRows]);
  const hasRowDrafts = useMemo(
    () =>
      mergedRows.some((row) => {
        const quantityDraft = pending[row.sku];
        const nameDraft = pendingNames[row.sku];
        return (
          (quantityDraft !== undefined &&
            (String(quantityDraft).trim() === '' ||
              Number(quantityDraft) !== row.quantity)) ||
          (nameDraft !== undefined &&
            nameDraft.trim() !== String(row.name || row.label || '').trim())
        );
      }),
    [mergedRows, pending, pendingNames]
  );

  function clearFeedback() {
    setError('');
    setSuccess('');
  }

  function mergeSavedRow(savedRow, fallback) {
    const normalized = normalizeRow({ ...fallback, ...savedRow });
    setRows((current) => {
      const exists = current.some((row) => row.sku === normalized.sku);
      const next = exists
        ? current.map((row) =>
            row.sku === normalized.sku ? { ...row, ...normalized } : row
          )
        : [...current, normalized];
      return next.sort((a, b) => a.sku.localeCompare(b.sku));
    });
  }

  async function setQuantity(sku, quantity, name, options = {}) {
    if (!canManage || savingSku) return false;
    const cleanSku = String(sku || '').trim();
    const cleanName = String(name || '').trim();
    if (!cleanSku) return false;
    const cleanQuantity = Number(quantity);
    if (
      String(quantity).trim() === '' ||
      !Number.isInteger(cleanQuantity) ||
      cleanQuantity < 0
    ) {
      setError('Quantity must be a non-negative whole number.');
      setSuccess('');
      return false;
    }

    setSavingSku(cleanSku);
    clearFeedback();

    try {
      const body = { sku: cleanSku, quantity: cleanQuantity };
      if (cleanName) body.name = cleanName;
      if (cleanQuantity > 0) body.hidden = false;
      if (options.createOnly) body.create = true;
      if (
        Object.prototype.hasOwnProperty.call(options, 'expectedUpdatedAt')
      ) {
        body.expected_updated_at = options.expectedUpdatedAt;
      }

      const res = await fetch('/api/store/admin/update-stock', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || 'Failed to update inventory.');
      }

      mergeSavedRow(data.updated?.[0], {
        sku: cleanSku,
        name: cleanName,
        quantity: cleanQuantity,
        hidden: cleanQuantity > 0 ? false : undefined,
      });
      setPending((current) => {
        const next = { ...current };
        delete next[cleanSku];
        return next;
      });
      setPendingNames((current) => {
        const next = { ...current };
        delete next[cleanSku];
        return next;
      });
      setSuccess(`${cleanSku} now has ${cleanQuantity} on hand.`);
      return true;
    } catch (err) {
      setError(err.message || 'Failed to update inventory.');
      return false;
    } finally {
      setSavingSku('');
    }
  }

  function handleSetClick(row) {
    const quantity =
      pending[row.sku] !== undefined ? pending[row.sku] : row.quantity;
    const name =
      pendingNames[row.sku] !== undefined
        ? pendingNames[row.sku]
        : row.name || row.label || '';
    setQuantity(
      row.sku,
      quantity,
      row.missingInventoryRow
        ? row.label || row.productName
        : row.inCatalog
          ? undefined
          : name,
      {
        ...(row.missingInventoryRow
          ? { createOnly: true }
          : { expectedUpdatedAt: row.updated_at || '' }),
      }
    );
  }

  async function handleAddSku(event) {
    event.preventDefault();
    const sku = customSku.trim();
    const name = newName.trim();

    if (!name || !sku) {
      setError('Product name and SKU are required.');
      return;
    }
    if (mergedRows.some((row) => row.sku === sku)) {
      setError('That SKU already exists in inventory or the store catalog.');
      return;
    }

    const saved = await setQuantity(sku, newQty || 0, name, {
      createOnly: true,
    });
    if (!saved) return;

    setCustomSku('');
    setNewName('');
    setNewQty('');
    setAddCloseConfirm(false);
    setAddOpen(false);
  }

  async function handleRemoveSku(sku) {
    if (!canManage || savingSku) return;
    const cleanSku = String(sku || '').trim();
    if (!cleanSku) return;

    setSavingSku(cleanSku);
    clearFeedback();

    try {
      const res = await fetch('/api/store/admin/update-stock', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: cleanSku,
          expected_updated_at:
            mergedRows.find((row) => row.sku === cleanSku)?.updated_at || '',
        }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || 'Failed to remove this custom SKU.');
      }

      setRows((current) => current.filter((row) => row.sku !== cleanSku));
      setPending((current) => {
        const next = { ...current };
        delete next[cleanSku];
        return next;
      });
      setPendingNames((current) => {
        const next = { ...current };
        delete next[cleanSku];
        return next;
      });
      setRemoveArmedSku('');
      setSuccess(`${cleanSku} was removed from inventory.`);
    } catch (err) {
      setError(err.message || 'Failed to remove this custom SKU.');
    } finally {
      setSavingSku('');
    }
  }

  async function setVisibility(row, hidden) {
    if (!canManage || savingSku) return;
    const cleanSku = String(row.sku || '').trim();
    if (!cleanSku) return;

    setSavingSku(cleanSku);
    clearFeedback();

    try {
      const res = await fetch('/api/store/admin/update-stock', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'visibility',
          sku: cleanSku,
          hidden: Boolean(hidden),
          expected_updated_at: row.updated_at || '',
        }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || 'Failed to update availability.');
      }

      mergeSavedRow(data.updated, { ...row, hidden: Boolean(hidden) });
      setSuccess(
        hidden
          ? `${cleanSku} moved to standby.`
          : `${cleanSku} is back in the active catalog.`
      );
    } catch (err) {
      setError(err.message || 'Failed to update availability.');
    } finally {
      setSavingSku('');
    }
  }

  function requestCloseAdd() {
    if (savingSku) return;
    if (addDirty) {
      setAddCloseConfirm(true);
      return;
    }
    setAddOpen(false);
  }

  function discardAddDraft() {
    setCustomSku('');
    setNewName('');
    setNewQty('');
    setAddCloseConfirm(false);
    setAddOpen(false);
    setError('');
  }

  return (
    <AdminLayout
      hasUnsavedChanges={hasRowDrafts || addDirty}
      unsavedChangesMessage="You have unsaved inventory edits. Leave this page and discard them?"
    >
      <div className={`${ui.page} ${styles.page}`}>
        <header className={ui.pageHeader}>
          <div>
            <span className={ui.eyebrow}>Store operations</span>
            <h1>Inventory</h1>
            <p>
              Keep every store variant accurate, surface low stock quickly, and
              move unavailable products into standby without losing their setup.
            </p>
          </div>
          <div className={styles.headerActions}>
            <button
              type="button"
              className={ui.tertiaryButton}
              onClick={refresh}
              disabled={loading || Boolean(savingSku) || hasRowDrafts}
              title={
                hasRowDrafts
                  ? 'Save or discard row edits before refreshing.'
                  : undefined
              }
            >
              <RefreshRoundedIcon aria-hidden="true" />
              Refresh
            </button>
            <button
              type="button"
              className={ui.primaryButton}
              onClick={() => {
                clearFeedback();
                setAddOpen(true);
              }}
              disabled={loading || !canManage}
            >
              <AddRoundedIcon aria-hidden="true" />
              Add manual SKU
            </button>
          </div>
        </header>

        {error ? (
          <div
            ref={pageErrorRef}
            className={ui.errorNotice}
            role="alert"
            tabIndex={-1}
          >
            {error}
          </div>
        ) : null}
        {success ? (
          <div className={ui.successNotice} role="status" aria-live="polite">
            <CheckCircleRoundedIcon aria-hidden="true" />
            {success}
          </div>
        ) : null}
        {!configured && !loading && !error ? (
          <div className={ui.readOnlyNotice} role="status">
            <CloudOffRoundedIcon aria-hidden="true" />
            <div>
              <strong>Preview mode</strong>
              <span>
                The catalog is visible, but the inventory database is not
                connected, so quantities cannot be changed.
              </span>
            </div>
          </div>
        ) : null}
        {configured && !canUpdate && !loading && !error ? (
          <div className={ui.readOnlyNotice} role="status">
            <CloudOffRoundedIcon aria-hidden="true" />
            <div>
              <strong>Read-only access</strong>
              <span>
                Your account can review stock levels but cannot publish
                inventory changes.
              </span>
            </div>
          </div>
        ) : null}

        <section className={styles.statsGrid} aria-label="Inventory overview">
          <div className={ui.statCard}>
            <span>Catalog SKUs</span>
            <strong>{loading ? '—' : summary.catalog}</strong>
            <small>Active store variants</small>
          </div>
          <div className={ui.statCard}>
            <span>Units on hand</span>
            <strong>{loading ? '—' : summary.units}</strong>
            <small>Across catalog inventory</small>
          </div>
          <div className={`${ui.statCard} ${styles.attentionCard}`}>
            <span>Needs attention</span>
            <strong>{loading ? '—' : summary.attention}</strong>
            <small>Low or sold-out variants</small>
          </div>
          <div className={ui.statCard}>
            <span>Standby</span>
            <strong>{loading ? '—' : summary.standby}</strong>
            <small>Saved outside the active store</small>
          </div>
          <div className={`${ui.statCard} ${styles.connectionCard}`}>
            {configured ? (
              <CloudDoneRoundedIcon aria-hidden="true" />
            ) : (
              <CloudOffRoundedIcon aria-hidden="true" />
            )}
            <div>
              <span>Custom SKUs</span>
              <strong>{loading ? '—' : summary.custom}</strong>
              <small>{configured ? 'Inventory connected' : 'Preview only'}</small>
            </div>
          </div>
        </section>

        <section className={`${ui.rosterSurface} ${styles.inventorySurface}`}>
          <div className={`${ui.rosterToolbar} ${styles.toolbar}`}>
            <div className={ui.searchField}>
              <SearchRoundedIcon aria-hidden="true" />
              <label htmlFor="inventory-search" className={ui.visuallyHidden}>
                Search inventory
              </label>
              <input
                id="inventory-search"
                type="search"
                value={query}
                placeholder="Search product, SKU, size, or color"
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className={styles.filterGrid}>
              <label>
                <span>Status</span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="all">All statuses</option>
                  <option value="in-stock">In stock</option>
                  <option value="low">Low stock</option>
                  <option value="sold-out">Sold out / setup needed</option>
                  <option value="standby">Standby</option>
                  <option value="unused">Custom SKUs</option>
                </select>
              </label>
              <label>
                <span>Product</span>
                <select
                  value={productFilter}
                  onChange={(event) => setProductFilter(event.target.value)}
                >
                  <option value="all">All products</option>
                  {productOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                  <option value="__unused">Custom SKUs</option>
                </select>
              </label>
              <label>
                <span>Sort</span>
                <select
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value)}
                >
                  <option value="status">Attention first</option>
                  <option value="product">Product name</option>
                  <option value="quantity-desc">Quantity: high to low</option>
                  <option value="quantity-asc">Quantity: low to high</option>
                  <option value="sku">SKU</option>
                </select>
              </label>
            </div>
          </div>

          {hasRowDrafts ? (
            <div className={styles.draftNotice} role="status">
              <div>
                <strong>Unsaved inventory edits</strong>
                <span>
                  Save the changed rows, or discard the drafts before
                  refreshing.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPending({});
                  setPendingNames({});
                }}
                disabled={Boolean(savingSku)}
              >
                Discard row edits
              </button>
            </div>
          ) : null}

          {loading ? (
            <div className={ui.loadingState} role="status">
              <span />
              Loading inventory…
            </div>
          ) : filteredRows.length ? (
            <div className={styles.tableScroll}>
              <table className={styles.inventoryTable}>
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col">SKU</th>
                    <th scope="col">Status</th>
                    <th scope="col">On hand</th>
                    <th scope="col">Update quantity</th>
                    <th scope="col">Availability</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const quantityValue =
                      pending[row.sku] !== undefined
                        ? pending[row.sku]
                        : row.quantity;
                    const nameValue =
                      pendingNames[row.sku] !== undefined
                        ? pendingNames[row.sku]
                        : row.name || row.label || '';
                    const quantityDirty =
                      pending[row.sku] !== undefined &&
                      Number(pending[row.sku]) !== row.quantity;
                    const nameDirty =
                      pendingNames[row.sku] !== undefined &&
                      pendingNames[row.sku].trim() !==
                        String(row.name || row.label || '').trim();
                    const rowDirty =
                      quantityDirty || nameDirty || row.missingInventoryRow;
                    const rowBusy = savingSku === row.sku;

                    return (
                      <tr
                        key={row.sku}
                        className={
                          ['missing', 'sold-out', 'low'].includes(
                            getStatus(row).id
                          )
                            ? styles.attentionRow
                            : ''
                        }
                      >
                        <td data-label="Product">
                          {row.inCatalog ? (
                            <div className={styles.productCell}>
                              <strong>{row.label || row.name || 'Unnamed product'}</strong>
                              {row.productName && row.productName !== row.label ? (
                                <span>{row.productName}</span>
                              ) : null}
                            </div>
                          ) : (
                            <Field
                              label="Custom product name"
                              htmlFor={`inventory-name-${row.sku}`}
                            >
                              <input
                                id={`inventory-name-${row.sku}`}
                                className={`${ui.input} ${styles.nameInput}`}
                                value={nameValue}
                                onChange={(event) =>
                                  setPendingNames((current) => ({
                                    ...current,
                                    [row.sku]: event.target.value,
                                  }))
                                }
                                disabled={!canManage || Boolean(savingSku)}
                              />
                            </Field>
                          )}
                        </td>
                        <td data-label="SKU">
                          <code className={styles.skuCode}>{row.sku}</code>
                          <span
                            className={styles.updatedAt}
                            title={formatUpdatedAt(row.updated_at)}
                          >
                            {formatUpdatedAt(row.updated_at)}
                          </span>
                        </td>
                        <td data-label="Status">
                          <StatusBadge row={row} />
                        </td>
                        <td data-label="On hand">
                          <strong className={styles.quantityValue}>
                            {row.quantity}
                          </strong>
                        </td>
                        <td data-label="Update quantity">
                          <div className={styles.quantityEditor}>
                            <label
                              htmlFor={`inventory-quantity-${row.sku}`}
                              className={ui.visuallyHidden}
                            >
                              Quantity for {row.label || row.name || row.sku}
                            </label>
                            <input
                              id={`inventory-quantity-${row.sku}`}
                              type="number"
                              min="0"
                              step="1"
                              className={ui.input}
                              value={quantityValue}
                              onChange={(event) =>
                                setPending((current) => ({
                                  ...current,
                                  [row.sku]: event.target.value,
                                }))
                              }
                              disabled={!canManage || Boolean(savingSku)}
                            />
                            <button
                              type="button"
                              className={styles.saveRowButton}
                              onClick={() => handleSetClick(row)}
                              disabled={
                                !canManage || Boolean(savingSku) || !rowDirty
                              }
                              aria-label={`Save quantity for ${row.sku}`}
                            >
                              <SaveRoundedIcon aria-hidden="true" />
                              {rowBusy ? 'Saving…' : 'Save'}
                            </button>
                            {row.quantity > 0 ? (
                              <button
                                type="button"
                                className={styles.zeroButton}
                                onClick={() =>
                                  setQuantity(
                                    row.sku,
                                    0,
                                    row.inCatalog ? undefined : nameValue,
                                    {
                                      expectedUpdatedAt:
                                        row.updated_at || '',
                                    }
                                  )
                                }
                                disabled={!canManage || Boolean(savingSku)}
                                aria-label={`Set ${row.sku} quantity to zero`}
                              >
                                Set 0
                              </button>
                            ) : null}
                          </div>
                        </td>
                        <td data-label="Availability">
                          {!row.inCatalog ? (
                            removeArmedSku === row.sku ? (
                              <div className={styles.confirmActions} role="alert">
                                <span>Remove this custom SKU?</span>
                                <div>
                                  <button
                                    type="button"
                                    className={styles.removeConfirmButton}
                                    onClick={() => handleRemoveSku(row.sku)}
                                    disabled={Boolean(savingSku)}
                                    aria-label={`Confirm removal of ${row.sku}`}
                                    autoFocus
                                  >
                                    Remove
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.cancelButton}
                                    onClick={() => setRemoveArmedSku('')}
                                    disabled={Boolean(savingSku)}
                                  >
                                    Keep
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className={styles.removeButton}
                                onClick={() => setRemoveArmedSku(row.sku)}
                                disabled={!canManage || Boolean(savingSku)}
                                aria-label={`Remove custom SKU ${row.sku}`}
                              >
                                <DeleteOutlineRoundedIcon aria-hidden="true" />
                                Remove
                              </button>
                            )
                          ) : row.missingInventoryRow ? (
                            <span className={styles.actionHint}>
                              Save a quantity to begin tracking.
                            </span>
                          ) : row.hidden ? (
                            <button
                              type="button"
                              className={styles.restoreButton}
                              onClick={() => setVisibility(row, false)}
                              disabled={!canManage || Boolean(savingSku)}
                              aria-label={`Restore ${row.sku} from standby`}
                            >
                              Restore from standby
                            </button>
                          ) : row.quantity <= 0 ? (
                            <button
                              type="button"
                              className={styles.standbyButton}
                              onClick={() => setVisibility(row, true)}
                              disabled={!canManage || Boolean(savingSku)}
                              aria-label={`Move ${row.sku} to standby`}
                            >
                              Move to standby
                            </button>
                          ) : (
                            <span className={styles.availableLabel}>
                              <CheckCircleRoundedIcon aria-hidden="true" />
                              Available
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <Inventory2RoundedIcon aria-hidden="true" />
              <strong>No inventory matches these filters</strong>
              <span>Try a broader search or clear one of the filters.</span>
            </div>
          )}
        </section>
      </div>

      <Drawer
        anchor="right"
        open={addOpen}
        onClose={requestCloseAdd}
        PaperProps={{ className: ui.drawerPaper }}
      >
        <form className={ui.editor} onSubmit={handleAddSku}>
          <header className={ui.editorHeader}>
            <div>
              <span className={ui.eyebrow}>Custom inventory</span>
              <h2>Add a manual SKU</h2>
              <div className={ui.editorStatusLine}>
                <span className={styles.customBadge}>Custom SKU</span>
                {addDirty ? (
                  <span className={ui.unsavedBadge}>Draft in progress</span>
                ) : (
                  <span className={ui.savedBadge}>Ready to start</span>
                )}
              </div>
            </div>
            <button
              type="button"
              className={ui.closeButton}
              onClick={requestCloseAdd}
              aria-label="Close add manual SKU form"
              disabled={Boolean(savingSku)}
            >
              <CloseRoundedIcon aria-hidden="true" />
            </button>
          </header>

          {error ? (
            <div
              ref={drawerErrorRef}
              className={ui.errorNotice}
              role="alert"
              tabIndex={-1}
            >
              {error}
            </div>
          ) : null}

          <div className={ui.editorBody}>
            <section className={ui.formSection}>
              <div className={ui.formSectionHeading}>
                <span>01</span>
                <div>
                  <h3>Product record</h3>
                  <p>
                    Use this for inventory that is not already represented in
                    the store catalog.
                  </p>
                </div>
              </div>
              <Field
                label="Product name"
                htmlFor="new-inventory-name"
                hint="A clear internal name for this custom item."
                required
              >
                <input
                  id="new-inventory-name"
                  className={ui.input}
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="New Shirt — Black — Medium"
                  disabled={Boolean(savingSku)}
                  required
                />
              </Field>
              <div className={ui.fieldGrid}>
                <Field
                  label="SKU"
                  htmlFor="new-inventory-sku"
                  hint="Must be unique."
                  required
                >
                  <input
                    id="new-inventory-sku"
                    className={ui.input}
                    value={customSku}
                    onChange={(event) => setCustomSku(event.target.value)}
                    placeholder="new-shirt-black-m"
                    disabled={Boolean(savingSku)}
                    required
                  />
                </Field>
                <Field
                  label="Starting quantity"
                  htmlFor="new-inventory-quantity"
                  hint="Use zero if stock has not arrived."
                >
                  <input
                    id="new-inventory-quantity"
                    type="number"
                    min="0"
                    step="1"
                    className={ui.input}
                    value={newQty}
                    onChange={(event) => setNewQty(event.target.value)}
                    placeholder="0"
                    disabled={Boolean(savingSku)}
                  />
                </Field>
              </div>
              <div className={styles.addNote}>
                Catalog products are already listed in the main table. Add a
                custom SKU only when the item does not exist there.
              </div>
            </section>
          </div>

          <footer className={ui.editorFooter}>
            {addCloseConfirm ? (
              <div className={ui.discardPrompt} role="alert">
                <div>
                  <strong>Discard this product draft?</strong>
                  <span>Nothing has been added to inventory yet.</span>
                </div>
                <div>
                  <button
                    type="button"
                    className={ui.dangerOutlineButton}
                    onClick={discardAddDraft}
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    className={ui.tertiaryButton}
                    onClick={() => setAddCloseConfirm(false)}
                  >
                    Keep editing
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className={ui.saveContext}>
                  <strong>{addDirty ? 'Product draft' : 'No details yet'}</strong>
                  <span>
                    This record is added only after you select Add manual SKU.
                  </span>
                </div>
                <div className={ui.footerButtons}>
                  <button
                    type="button"
                    className={ui.tertiaryButton}
                    onClick={requestCloseAdd}
                    disabled={Boolean(savingSku)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={ui.primaryButton}
                    disabled={
                      !canManage ||
                      Boolean(savingSku) ||
                      !newName.trim() ||
                      !customSku.trim()
                    }
                  >
                    <AddRoundedIcon aria-hidden="true" />
                    {savingSku ? 'Adding…' : 'Add manual SKU'}
                  </button>
                </div>
              </>
            )}
          </footer>
        </form>
      </Drawer>
    </AdminLayout>
  );
}
