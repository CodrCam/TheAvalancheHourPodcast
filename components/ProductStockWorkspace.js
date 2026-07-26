import { useMemo, useState } from 'react';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import {
  describeSkuOptions,
  getProductTaxonomy,
} from '../lib/productCatalogStructure.mjs';
import styles from '../styles/ProductStockWorkspace.module.css';

const LOW_STOCK_THRESHOLD = 2;

function normalizeInventoryRow(row = {}) {
  return {
    sku: String(row.sku || row.sku_key || '').trim(),
    name: String(row.name || row.product_name || '').trim(),
    quantity: Math.max(0, Math.trunc(Number(row.quantity) || 0)),
    hidden: row.hidden === true || row.hidden === 'true',
    updatedAt: row.updated_at || row.updatedAt || row.inventoryUpdatedAt || '',
  };
}

function getStockState(row) {
  if (!row.inCatalog) return { id: 'orphan', label: 'Legacy record' };
  if (row.missingInventoryRow) return { id: 'missing', label: 'Needs setup' };
  if (row.hidden) return { id: 'standby', label: 'Standby' };
  if (row.quantity <= 0) return { id: 'sold-out', label: 'Sold out' };
  if (row.quantity <= LOW_STOCK_THRESHOLD) {
    return { id: 'low', label: 'Low stock' };
  }
  return { id: 'in-stock', label: 'In stock' };
}

function attentionRank(row) {
  return {
    missing: 0,
    'sold-out': 1,
    low: 2,
    standby: 3,
    'in-stock': 4,
    orphan: 5,
  }[getStockState(row).id] ?? 6;
}

function variantName(entry, optionLabels) {
  const options = describeSkuOptions(entry, optionLabels);
  return options.length
    ? options.map((option) => option.value).join(' · ')
    : entry.label || entry.sku;
}

function formatUpdatedAt(value) {
  if (!value) return 'Not synced yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently updated';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export default function ProductStockWorkspace({
  products = [],
  inventoryRows = [],
  inventoryConfigured = false,
  canUpdateInventory = false,
  loading = false,
  refreshDisabled = false,
  onRefresh,
  onEditProduct,
  onStockChange,
  onOrphanRemoved,
}) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [pending, setPending] = useState({});
  const [savingSku, setSavingSku] = useState('');
  const [removeArmedSku, setRemoveArmedSku] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const canManage = inventoryConfigured && canUpdateInventory;

  const inventoryMap = useMemo(
    () =>
      new Map(
        inventoryRows
          .map(normalizeInventoryRow)
          .filter((row) => row.sku)
          .map((row) => [row.sku, row])
      ),
    [inventoryRows]
  );

  const catalogRows = useMemo(
    () =>
      products.flatMap((product) => {
        const taxonomy = getProductTaxonomy(product);
        return (product.skuEntries || []).map((entry, variantIndex) => {
          const inventory = inventoryMap.get(entry.sku);
          return {
            ...entry,
            productId: product.id,
            productName: product.name,
            productImage: product.image,
            productStatus: product.status,
            taxonomy,
            variantIndex,
            variantName: variantName(entry, product.optionLabels),
            quantity: inventory?.quantity ?? (Number(entry.quantity) || 0),
            hidden: inventory?.hidden ?? entry.hidden === true,
            updatedAt:
              inventory?.updatedAt || entry.inventoryUpdatedAt || '',
            inCatalog: true,
            missingInventoryRow: !inventory,
          };
        });
      }),
    [inventoryMap, products]
  );

  const catalogSkuSet = useMemo(
    () => new Set(catalogRows.map((row) => row.sku)),
    [catalogRows]
  );

  const orphanRows = useMemo(
    () =>
      inventoryRows
        .map(normalizeInventoryRow)
        .filter((row) => row.sku && !catalogSkuSet.has(row.sku))
        .map((row) => ({
          ...row,
          label: row.name || row.sku,
          inCatalog: false,
          missingInventoryRow: false,
        })),
    [catalogSkuSet, inventoryRows]
  );

  const summary = useMemo(() => {
    const attention = catalogRows.filter((row) =>
      ['missing', 'sold-out', 'low'].includes(getStockState(row).id)
    ).length;
    return {
      variants: catalogRows.length,
      units: catalogRows.reduce((sum, row) => sum + row.quantity, 0),
      attention,
      standby: catalogRows.filter((row) => row.hidden).length,
      orphaned: orphanRows.length,
    };
  }, [catalogRows, orphanRows.length]);

  const filteredRows = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    return catalogRows
      .filter((row) => {
        const status = getStockState(row).id;
        const matchesStatus =
          statusFilter === 'all' ||
          status === statusFilter ||
          (statusFilter === 'attention' &&
            ['missing', 'sold-out', 'low'].includes(status));
        const searchable = [
          row.productName,
          row.variantName,
          row.sku,
          row.taxonomy.category,
          row.taxonomy.collection,
        ]
          .join(' ')
          .toLowerCase();
        return matchesStatus && (!cleanQuery || searchable.includes(cleanQuery));
      })
      .sort(
        (left, right) =>
          attentionRank(left) - attentionRank(right) ||
          left.productName.localeCompare(right.productName) ||
          left.variantIndex - right.variantIndex
      );
  }, [catalogRows, query, statusFilter]);

  const groupedRows = useMemo(() => {
    const groups = [];
    const groupMap = new Map();
    for (const row of filteredRows) {
      let group = groupMap.get(row.productId);
      if (!group) {
        group = {
          productId: row.productId,
          productName: row.productName,
          productImage: row.productImage,
          productStatus: row.productStatus,
          taxonomy: row.taxonomy,
          rows: [],
        };
        groupMap.set(row.productId, group);
        groups.push(group);
      }
      group.rows.push(row);
    }
    return groups;
  }, [filteredRows]);

  const visibleOrphans = useMemo(() => {
    if (!['all', 'orphan'].includes(statusFilter)) return [];
    const cleanQuery = query.trim().toLowerCase();
    return orphanRows.filter((row) =>
      cleanQuery
        ? [row.sku, row.name].join(' ').toLowerCase().includes(cleanQuery)
        : true
    );
  }, [orphanRows, query, statusFilter]);

  async function saveQuantity(row, nextQuantity) {
    if (!canManage || savingSku) return;
    const quantity = Number(nextQuantity);
    if (!Number.isInteger(quantity) || quantity < 0) {
      setError('Stock must be a non-negative whole number.');
      setNotice('');
      return;
    }

    setSavingSku(row.sku);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/store/admin/update-stock', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: row.sku,
          quantity,
          ...(row.missingInventoryRow
            ? {
                create: true,
                name: row.variantName || row.productName,
              }
            : { expected_updated_at: row.updatedAt || '' }),
        }),
      });
      const data = await response.json();
      if (!response.ok || data.ok === false) {
        throw new Error(data.error || 'Could not update stock.');
      }
      const updated = normalizeInventoryRow(data.updated?.[0] || {
        ...row,
        quantity,
      });
      onStockChange?.(updated);
      setPending((current) => {
        const next = { ...current };
        delete next[row.sku];
        return next;
      });
      setNotice(`${row.variantName} now has ${quantity} on hand.`);
    } catch (err) {
      setError(err.message || 'Could not update stock.');
    } finally {
      setSavingSku('');
    }
  }

  async function setVisibility(row, hidden) {
    if (!canManage || savingSku || row.missingInventoryRow) return;
    setSavingSku(row.sku);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/store/admin/update-stock', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'visibility',
          sku: row.sku,
          hidden,
          expected_updated_at: row.updatedAt || '',
        }),
      });
      const data = await response.json();
      if (!response.ok || data.ok === false) {
        throw new Error(data.error || 'Could not change availability.');
      }
      const updated = normalizeInventoryRow(data.updated || {
        ...row,
        hidden,
      });
      onStockChange?.(updated);
      setNotice(
        hidden
          ? `${row.variantName} moved to standby.`
          : `${row.variantName} is listed again.`
      );
    } catch (err) {
      setError(err.message || 'Could not change availability.');
    } finally {
      setSavingSku('');
    }
  }

  async function removeOrphan(row) {
    if (!canManage || savingSku) return;
    setSavingSku(row.sku);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/store/admin/update-stock', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: row.sku,
          expected_updated_at: row.updatedAt || '',
        }),
      });
      const data = await response.json();
      if (!response.ok || data.ok === false) {
        throw new Error(data.error || 'Could not remove the legacy record.');
      }
      onOrphanRemoved?.(row.sku);
      setRemoveArmedSku('');
      setNotice(`${row.sku} was removed from the legacy stock records.`);
    } catch (err) {
      setError(err.message || 'Could not remove the legacy record.');
    } finally {
      setSavingSku('');
    }
  }

  return (
    <div className={styles.workspace}>
      <div className={styles.stockHeader}>
        <div>
          <span>Operational stock</span>
          <h2>Stock command center</h2>
          <p>
            Find what needs attention, adjust counts quickly, and control which
            variants customers can purchase.
          </p>
        </div>
        <button
          type="button"
          className={styles.refreshButton}
          onClick={onRefresh}
          disabled={loading || Boolean(savingSku) || refreshDisabled}
        >
          <RefreshRoundedIcon aria-hidden="true" />
          Refresh stock
        </button>
      </div>

      {!inventoryConfigured && !loading ? (
        <div className={styles.connectionNotice}>
          <WarningAmberRoundedIcon aria-hidden="true" />
          <div>
            <strong>Stock data is not connected in this environment.</strong>
            <span>Catalog structure is available, but stock changes are disabled.</span>
          </div>
        </div>
      ) : null}
      {inventoryConfigured && !canUpdateInventory && !loading ? (
        <div className={styles.connectionNotice}>
          <WarningAmberRoundedIcon aria-hidden="true" />
          <div>
            <strong>Stock is read-only for this account.</strong>
            <span>You can review availability but cannot publish changes.</span>
          </div>
        </div>
      ) : null}
      {error ? <div className={styles.errorNotice}>{error}</div> : null}
      {notice ? (
        <div className={styles.successNotice}>
          <CheckCircleRoundedIcon aria-hidden="true" />
          {notice}
        </div>
      ) : null}

      <div className={styles.stockStats}>
        <div><span>Variants</span><strong>{loading ? '—' : summary.variants}</strong></div>
        <div><span>Units on hand</span><strong>{loading ? '—' : summary.units}</strong></div>
        <div className={summary.attention ? styles.statAttention : ''}>
          <span>Needs attention</span>
          <strong>{loading ? '—' : summary.attention}</strong>
        </div>
        <div><span>Standby</span><strong>{loading ? '—' : summary.standby}</strong></div>
        <div className={summary.orphaned ? styles.statLegacy : ''}>
          <span>Legacy records</span>
          <strong>{loading ? '—' : summary.orphaned}</strong>
        </div>
      </div>

      <div className={styles.stockToolbar}>
        <label className={styles.searchField}>
          <SearchRoundedIcon aria-hidden="true" />
          <span>Search stock</span>
          <input
            type="search"
            value={query}
            placeholder="Product, color, size, or SKU"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className={styles.filterChips} aria-label="Stock filters">
          {[
            ['all', 'All'],
            ['attention', 'Needs attention'],
            ['in-stock', 'In stock'],
            ['sold-out', 'Sold out'],
            ['standby', 'Standby'],
            ['orphan', 'Legacy'],
          ].map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={statusFilter === value ? styles.filterActive : ''}
              onClick={() => setStatusFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className={styles.loadingState}>Loading product stock…</div>
      ) : groupedRows.length || visibleOrphans.length ? (
        <div className={styles.stockGroups}>
          {groupedRows.map((group) => {
            const total = group.rows.reduce((sum, row) => sum + row.quantity, 0);
            return (
              <section className={styles.productStockCard} key={group.productId}>
                <header className={styles.productStockHeader}>
                  <div className={styles.productIdentity}>
                    <span className={styles.productStockImage}>
                      {group.productImage ? (
                        <img src={group.productImage} alt="" />
                      ) : (
                        <Inventory2RoundedIcon aria-hidden="true" />
                      )}
                    </span>
                    <div>
                      <small>
                        {group.taxonomy.category} / {group.taxonomy.collection}
                      </small>
                      <strong>{group.productName}</strong>
                      <span>
                        {group.rows.length} variants · {total} units
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={styles.editProductButton}
                    onClick={() => onEditProduct?.(group.productId)}
                  >
                    <EditRoundedIcon aria-hidden="true" />
                    Edit product
                  </button>
                </header>
                <div className={styles.variantStockList}>
                  {group.rows.map((row) => {
                    const state = getStockState(row);
                    const draftValue =
                      pending[row.sku] !== undefined
                        ? pending[row.sku]
                        : row.quantity;
                    const dirty =
                      pending[row.sku] !== undefined &&
                      Number(pending[row.sku]) !== row.quantity;
                    const busy = savingSku === row.sku;
                    return (
                      <div className={styles.variantStockRow} key={row.sku}>
                        <span className={styles.variantStockImage}>
                          {row.image ? (
                            <img src={row.image} alt="" />
                          ) : (
                            <Inventory2RoundedIcon aria-hidden="true" />
                          )}
                        </span>
                        <div className={styles.variantStockName}>
                          <strong>{row.variantName}</strong>
                          <code>{row.sku}</code>
                          <small>{formatUpdatedAt(row.updatedAt)}</small>
                        </div>
                        <span
                          className={`${styles.stockBadge} ${
                            styles[`stock_${state.id}`]
                          }`}
                        >
                          {state.label}
                        </span>
                        <div className={styles.quantityControl}>
                          <button
                            type="button"
                            onClick={() =>
                              saveQuantity(row, Math.max(0, row.quantity - 1))
                            }
                            disabled={!canManage || Boolean(savingSku) || row.quantity <= 0}
                            aria-label={`Remove one ${row.variantName}`}
                          >
                            <RemoveRoundedIcon aria-hidden="true" />
                          </button>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={draftValue}
                            onChange={(event) =>
                              setPending((current) => ({
                                ...current,
                                [row.sku]: event.target.value,
                              }))
                            }
                            disabled={!canManage || Boolean(savingSku)}
                            aria-label={`Stock for ${row.variantName}`}
                          />
                          <button
                            type="button"
                            onClick={() => saveQuantity(row, row.quantity + 1)}
                            disabled={!canManage || Boolean(savingSku)}
                            aria-label={`Add one ${row.variantName}`}
                          >
                            <AddRoundedIcon aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className={styles.saveStockButton}
                            onClick={() => saveQuantity(row, draftValue)}
                            disabled={!canManage || Boolean(savingSku) || (!dirty && !row.missingInventoryRow)}
                          >
                            {busy ? 'Saving…' : row.missingInventoryRow ? 'Start tracking' : 'Save'}
                          </button>
                        </div>
                        <div className={styles.rowActions}>
                          <button
                            type="button"
                            className={
                              row.hidden
                                ? styles.restoreButton
                                : styles.standbyButton
                            }
                            onClick={() => setVisibility(row, !row.hidden)}
                            disabled={
                              !canManage ||
                              Boolean(savingSku) ||
                              row.missingInventoryRow
                            }
                          >
                            {row.hidden ? 'List again' : 'Move to standby'}
                          </button>
                          <button
                            type="button"
                            className={styles.editVariantButton}
                            onClick={() =>
                              onEditProduct?.(row.productId, row.sku)
                            }
                          >
                            Edit details
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {visibleOrphans.length ? (
            <section className={styles.legacyCard}>
              <header>
                <div>
                  <span>Data cleanup</span>
                  <h3>Legacy stock records</h3>
                  <p>
                    These rows are not attached to any product. Create a proper
                    product if they are still sellable; otherwise remove them.
                  </p>
                </div>
                <strong>{visibleOrphans.length}</strong>
              </header>
              <div className={styles.legacyList}>
                {visibleOrphans.map((row) => (
                  <div className={styles.legacyRow} key={row.sku}>
                    <div>
                      <strong>{row.name || 'Unnamed legacy item'}</strong>
                      <code>{row.sku}</code>
                    </div>
                    <span>{row.quantity} units</span>
                    {removeArmedSku === row.sku ? (
                      <div className={styles.removeConfirm}>
                        <button
                          type="button"
                          onClick={() => removeOrphan(row)}
                          disabled={!canManage || Boolean(savingSku)}
                        >
                          Remove record
                        </button>
                        <button
                          type="button"
                          onClick={() => setRemoveArmedSku('')}
                        >
                          Keep
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={styles.removeLegacyButton}
                        onClick={() => setRemoveArmedSku(row.sku)}
                        disabled={!canManage || Boolean(savingSku)}
                      >
                        <DeleteOutlineRoundedIcon aria-hidden="true" />
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <Inventory2RoundedIcon aria-hidden="true" />
          <strong>No stock matches this view.</strong>
          <span>Try a broader search or select another filter.</span>
        </div>
      )}
    </div>
  );
}
