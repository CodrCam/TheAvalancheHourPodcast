import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import UploadRoundedIcon from '@mui/icons-material/UploadRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import AdminLayout from '../../components/AdminLayout';
import ProductStockWorkspace from '../../components/ProductStockWorkspace';
import { slugifyProduct } from '../../lib/productCatalogAdmin.mjs';
import {
  describeSkuOptions,
  getProductMedia,
  getProductOptionLabels,
  getProductTaxonomy,
  groupProductsByTaxonomy,
} from '../../lib/productCatalogStructure.mjs';
import {
  formatProductPriceInput,
  isProductPriceInput,
  isProductStockInput,
  productPriceInputToCents,
  productStockInputToQuantity,
} from '../../lib/productNumberInputs.mjs';
import styles from '../../styles/AdminProducts.module.css';

const STATUS_COPY = {
  draft: 'Backend only. Finish the details before publishing.',
  live: 'Visible in the storefront. Zero inventory appears as Sold out.',
  standby: 'Temporarily removed from the storefront for a possible return.',
  archived: 'Retired from the storefront and preserved for order history.',
};

const DEFAULT_PRODUCT_CATEGORIES = [
  'Headwear',
  'Apparel',
  'Field gear',
  'Bags',
  'Accessories',
  'Other goods',
];

function newProduct() {
  const id = `product-${Date.now().toString(36)}`;
  return {
    id,
    slug: '',
    name: '',
    category: 'Other goods',
    collection: 'Avalanche Hour',
    label: 'Avalanche Hour field goods',
    description: '',
    status: 'draft',
    price: 0,
    sortOrder: 0,
    version: 1,
    optionLabels: { style: 'Style', color: 'Color', size: 'Size' },
    media: [],
    skuEntries: [
      {
        sku: '',
        label: '',
        options: {},
        price: 0,
        quantity: 0,
        hidden: false,
        active: true,
      },
    ],
    _new: true,
    _slugTouched: false,
  };
}

function editableProduct(product) {
  const skuEntries = (product.skuEntries || []).map((entry) => ({
    ...entry,
    options: entry.options || {},
    quantity: Number(entry.quantity) || 0,
    hidden: entry.hidden === true,
    active: entry.active !== false,
  }));
  const taxonomy = getProductTaxonomy(product);
  const media = getProductMedia({ ...product, skuEntries }).map((item) =>
    item.shared
      ? {
          ...item,
          assignedSkus: skuEntries.map((entry) => entry.sku),
          shared: false,
        }
      : item
  );

  return {
    ...product,
    ...taxonomy,
    optionLabels: getProductOptionLabels(product),
    media: media.map((item, index) => ({
      ...item,
      sortOrder: index,
    })),
    skuEntries,
    _new: false,
    _slugTouched: true,
  };
}

function cleanPayload(product) {
  const { _new, _slugTouched, ...clean } = product;
  const entries = clean.skuEntries.map((entry) => {
    const {
      _priceInput,
      _quantityInput,
      ...cleanEntry
    } = entry;
    return {
      ...cleanEntry,
      sku: String(entry.sku || '').trim(),
      label: String(entry.label || '').trim(),
      price: Math.max(0, Math.trunc(Number(entry.price) || 0)),
      quantity: Math.max(0, Math.trunc(Number(entry.quantity) || 0)),
      options: Object.fromEntries(
        Object.entries(entry.options || {}).filter(([, value]) =>
          String(value || '').trim()
        )
      ),
    };
  });
  return {
    ...clean,
    price: entries.find((entry) => entry.active)?.price || 0,
    skuEntries: entries,
    media: clean.media.map((item, index) => ({
      assetId: item.assetId,
      source: item.source,
      objectKey: item.objectKey,
      altText: item.altText || clean.name,
      role: index === 0 ? 'hero' : 'gallery',
      sortOrder: index,
      assignedSkus: item.assignedSkus || [],
      shared: item.shared === true,
    })),
  };
}

function fingerprint(product) {
  return JSON.stringify(cleanPayload(product));
}

function money(cents) {
  return (Number(cents || 0) / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
}

function Field({ label, hint, children }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

function variantTitle(entry, optionLabels) {
  const options = describeSkuOptions(entry, optionLabels);
  if (options.length) return options.map((option) => option.value).join(' · ');
  return entry.label || entry.sku || 'Single product';
}

function mediaUrl(item) {
  return item?.previewUrl || item?.url || item?.objectKey || '';
}

function mediaForDefaultVariant(media, entries) {
  const primaryImage = entries[0]?.image;
  if (!primaryImage) return media;
  const primaryIndex = media.findIndex(
    (item) => mediaUrl(item) === primaryImage
  );
  if (primaryIndex <= 0) return media;
  const next = [...media];
  const [primary] = next.splice(primaryIndex, 1);
  next.unshift(primary);
  return next;
}

export default function AdminProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [inventoryRows, setInventoryRows] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [draft, setDraft] = useState(null);
  const [baseline, setBaseline] = useState('');
  const [capabilities, setCapabilities] = useState({
    canUpdate: false,
    canPublish: false,
    canUpdateMedia: false,
    mediaStorageConfigured: false,
    inventoryConfigured: false,
    canUpdateInventory: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const activeView = router.query.view === 'stock' ? 'stock' : 'catalog';

  const dirty = Boolean(draft && baseline && fingerprint(draft) !== baseline);
  const stats = useMemo(
    () => ({
      live: products.filter((product) => product.status === 'live').length,
      standby: products.filter((product) => product.status === 'standby').length,
      draft: products.filter((product) => product.status === 'draft').length,
      skus: products.reduce(
        (sum, product) => sum + (product.skuEntries?.length || 0),
        0
      ),
    }),
    [products]
  );
  const catalogGroups = useMemo(
    () => groupProductsByTaxonomy(products),
    [products]
  );
  const categoryOptions = useMemo(
    () => [
      ...new Set([
        ...DEFAULT_PRODUCT_CATEGORIES,
        ...products.map((product) => getProductTaxonomy(product).category),
        draft?.category,
      ].filter(Boolean)),
    ],
    [draft?.category, products]
  );
  const variantGroups = useMemo(() => {
    const groups = [];
    const groupMap = new Map();
    for (const [index, entry] of (draft?.skuEntries || []).entries()) {
      const groupName = String(entry.options?.style || '').trim() || 'Single product';
      let group = groupMap.get(groupName);
      if (!group) {
        group = { name: groupName, entries: [] };
        groupMap.set(groupName, group);
        groups.push(group);
      }
      group.entries.push({ entry, index });
    }
    return groups;
  }, [draft?.skuEntries]);
  const selectedVariant =
    draft?.skuEntries?.[selectedVariantIndex] || draft?.skuEntries?.[0] || null;

  async function loadProducts(preferredId = selectedId) {
    setLoading(true);
    setError('');
    try {
      const [response, stockResponse] = await Promise.all([
        fetch('/api/store/admin/products'),
        fetch('/api/store/admin/stock'),
      ]);
      const [data, stockData] = await Promise.all([
        response.json(),
        stockResponse.json(),
      ]);
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Could not load products.');
      }
      if (!stockResponse.ok || !stockData.ok) {
        throw new Error(stockData.error || 'Could not load product stock.');
      }
      setProducts(data.products || []);
      setInventoryRows(stockData.inventory || []);
      setCapabilities({
        canUpdate: data.canUpdate === true,
        canPublish: data.canPublish === true,
        canUpdateMedia: data.canUpdateMedia === true,
        mediaStorageConfigured: data.mediaStorageConfigured === true,
        inventoryConfigured: stockData.configured === true,
        canUpdateInventory: stockData.canUpdate === true,
      });
      const selected =
        data.products.find((product) => product.id === preferredId) ||
        data.products[0];
      if (selected) selectProduct(selected, false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Initial data load is intentionally delegated to the async request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadProducts('');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function selectProduct(product, confirmDirty = true) {
    if (
      confirmDirty &&
      dirty &&
      !window.confirm('Discard the unsaved product changes?')
    ) {
      return;
    }
    const next = editableProduct(product);
    setSelectedId(product.id);
    setDraft(next);
    setBaseline(fingerprint(next));
    setNotice('');
    setError('');
    setImageUrl('');
    setSelectedVariantIndex(0);
  }

  function startNewProduct() {
    if (dirty && !window.confirm('Discard the unsaved product changes?')) return;
    const next = newProduct();
    setSelectedId(next.id);
    setDraft(next);
    setBaseline(fingerprint(next));
    setNotice('');
    setError('');
    setImageUrl('');
    setSelectedVariantIndex(0);
  }

  function showView(view) {
    if (
      view !== activeView &&
      dirty &&
      !window.confirm('Discard the unsaved product changes before switching views?')
    ) {
      return;
    }
    if (dirty) {
      const persisted = products.find((product) => product.id === selectedId);
      if (persisted) selectProduct(persisted, false);
    }
    router.replace(
      {
        pathname: '/admin/products',
        query: view === 'stock' ? { view: 'stock' } : {},
      },
      undefined,
      { shallow: true }
    );
  }

  function handleStockChange(updated) {
    setInventoryRows((current) => [
      ...current.filter((row) => row.sku !== updated.sku),
      {
        ...updated,
        updated_at: updated.updatedAt || updated.updated_at || '',
      },
    ]);

    const updateProductStock = (product) => ({
      ...product,
      skuEntries: (product.skuEntries || []).map((entry) =>
        entry.sku === updated.sku
          ? {
              ...entry,
              quantity: updated.quantity,
              hidden: updated.hidden,
              inventoryUpdatedAt:
                updated.updatedAt || updated.updated_at || '',
            }
          : entry
      ),
    });
    setProducts((current) => current.map(updateProductStock));

    if (draft && !dirty) {
      const nextDraft = updateProductStock(draft);
      setDraft(nextDraft);
      setBaseline(fingerprint(nextDraft));
    }
  }

  function handleOrphanRemoved(sku) {
    setInventoryRows((current) => current.filter((row) => row.sku !== sku));
  }

  function editProductFromStock(productId, sku = '') {
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    selectProduct(product, false);
    if (sku) {
      const variantIndex = (product.skuEntries || []).findIndex(
        (entry) => entry.sku === sku
      );
      if (variantIndex >= 0) setSelectedVariantIndex(variantIndex);
    }
    router.replace('/admin/products', undefined, { shallow: true });
  }

  function updateProduct(patch) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function updateVariant(index, patch) {
    setDraft((current) => ({
      ...current,
      skuEntries: current.skuEntries.map((entry, entryIndex) => {
        if (entryIndex !== index) return entry;
        const next = { ...entry, ...patch };
        if (patch.sku !== undefined && patch.sku !== entry.sku) {
          next.sku = patch.sku;
        }
        return next;
      }),
      media:
        patch.sku !== undefined
          ? current.media.map((item) => ({
              ...item,
              assignedSkus: (item.assignedSkus || []).map((sku) =>
                sku === current.skuEntries[index].sku ? patch.sku : sku
              ),
            }))
          : current.media,
    }));
  }

  function updateVariantOption(index, key, value) {
    updateVariant(index, {
      options: { ...(draft.skuEntries[index].options || {}), [key]: value },
    });
  }

  function updateVariantPriceInput(index, value) {
    if (!isProductPriceInput(value)) return;
    const cents = productPriceInputToCents(value);
    updateVariant(index, {
      _priceInput: value,
      ...(cents === null ? {} : { price: cents }),
    });
  }

  function finishVariantPriceInput(index, value) {
    const cents = productPriceInputToCents(value) ?? 0;
    updateVariant(index, {
      price: cents,
      _priceInput: undefined,
    });
  }

  function updateVariantStockInput(index, value) {
    if (!isProductStockInput(value)) return;
    const quantity = productStockInputToQuantity(value);
    updateVariant(index, {
      _quantityInput: value,
      ...(quantity === null ? {} : { quantity }),
    });
  }

  function finishVariantStockInput(index, value) {
    const quantity = productStockInputToQuantity(value) ?? 0;
    updateVariant(index, {
      quantity,
      _quantityInput: undefined,
    });
  }

  function addVariant() {
    const nextIndex = draft.skuEntries.length;
    updateProduct({
      skuEntries: [
        ...draft.skuEntries,
        {
          sku: `new-sku-${Date.now().toString(36)}`,
          label: 'New variant',
          options: {},
          price: draft.skuEntries[0]?.price || 0,
          quantity: 0,
          hidden: false,
          active: true,
        },
      ],
    });
    setSelectedVariantIndex(nextIndex);
  }

  function removeVariant(index) {
    if (draft.skuEntries.length === 1) {
      setError('A product must keep at least one SKU.');
      return;
    }
    updateProduct({
      skuEntries: draft.skuEntries.filter((_, entryIndex) => entryIndex !== index),
      media: draft.media.map((item) => ({
        ...item,
        assignedSkus: (item.assignedSkus || []).filter(
          (sku) => sku !== draft.skuEntries[index].sku
        ),
      })),
    });
    setSelectedVariantIndex((current) =>
      Math.max(0, Math.min(current, draft.skuEntries.length - 2))
    );
  }

  function moveVariant(index, direction) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= draft.skuEntries.length) return;
    setDraft((current) => {
      const entries = [...current.skuEntries];
      [entries[index], entries[nextIndex]] = [
        entries[nextIndex],
        entries[index],
      ];
      return {
        ...current,
        skuEntries: entries,
        media: mediaForDefaultVariant(current.media, entries),
      };
    });
    setSelectedVariantIndex(nextIndex);
  }

  function makeVariantDefault(index) {
    if (index === 0) return;
    setDraft((current) => {
      const entries = [...current.skuEntries];
      const [entry] = entries.splice(index, 1);
      entries.unshift(entry);
      return {
        ...current,
        skuEntries: entries,
        media: mediaForDefaultVariant(current.media, entries),
      };
    });
    setSelectedVariantIndex(0);
  }

  function assignPrimaryImage(mediaIndex) {
    const entry = draft.skuEntries[selectedVariantIndex];
    const item = draft.media[mediaIndex];
    if (!entry || !item) return;
    const image = item.url || item.objectKey;
    setDraft((current) => ({
      ...current,
      skuEntries: current.skuEntries.map((variant, index) =>
        index === selectedVariantIndex ? { ...variant, image } : variant
      ),
      media: mediaForDefaultVariant(
        current.media.map((mediaItem, index) => ({
          ...mediaItem,
          assignedSkus:
            index === mediaIndex
              ? [...new Set([...(mediaItem.assignedSkus || []), entry.sku])]
              : mediaItem.assignedSkus || [],
        })),
        current.skuEntries.map((variant, index) =>
          index === selectedVariantIndex ? { ...variant, image } : variant
        )
      ),
    }));
  }

  function toggleVariantGalleryImage(mediaIndex) {
    const entry = draft.skuEntries[selectedVariantIndex];
    const item = draft.media[mediaIndex];
    if (!entry || !item) return;
    const isPrimary = entry.image === (item.url || item.objectKey);
    const isAssigned = (item.assignedSkus || []).includes(entry.sku);
    if (isPrimary && isAssigned) {
      setError('Choose a different primary image before removing this one.');
      return;
    }
    setError('');
    setDraft((current) => ({
      ...current,
      media: current.media.map((mediaItem, index) => {
        if (index !== mediaIndex) return mediaItem;
        const assigned = mediaItem.assignedSkus || [];
        return {
          ...mediaItem,
          assignedSkus: isAssigned
            ? assigned.filter((sku) => sku !== entry.sku)
            : [...new Set([...assigned, entry.sku])],
        };
      }),
    }));
  }

  function appendMedia(item) {
    const entry = draft.skuEntries[selectedVariantIndex];
    const url = item.url || item.objectKey;
    const nextItem = {
      ...item,
      url,
      assignedSkus: entry?.sku ? [entry.sku] : [],
      shared: false,
    };
    setDraft((current) => {
      const entries = current.skuEntries.map((variant, index) =>
        index === selectedVariantIndex && !variant.image
          ? { ...variant, image: url }
          : variant
      );
      return {
        ...current,
        media: mediaForDefaultVariant([...current.media, nextItem], entries),
        skuEntries: entries,
      };
    });
  }

  function addExternalImage() {
    const value = imageUrl.trim();
    if (!/^https:\/\//i.test(value) && !value.startsWith('/images/')) {
      setError('Use a complete https:// URL or an existing /images/ path.');
      return;
    }
    appendMedia({
      assetId: `external-${Date.now().toString(36)}`,
      source: value.startsWith('/images/') ? 'local' : 'remote',
      objectKey: value,
      url: value,
      altText: draft.name,
    });
    setImageUrl('');
    setError('');
  }

  async function uploadImage(file) {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const productId = draft.id || `product-${slugifyProduct(draft.name)}`;
      const prepareResponse = await fetch(
        '/api/store/admin/product-media/presign',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product_id: productId,
            file: {
              file_name: file.name,
              content_type: file.type,
              size: file.size,
            },
          }),
        }
      );
      const prepared = await prepareResponse.json();
      if (!prepareResponse.ok || !prepared.ok) {
        throw new Error(prepared.error || 'Could not prepare the upload.');
      }
      const uploadFields = prepared.upload.upload_fields || {};
      const uploadBody = new FormData();
      Object.entries(uploadFields).forEach(([name, value]) => {
        uploadBody.append(name, String(value));
      });
      uploadBody.append('file', file);
      const uploadResponse = await fetch(prepared.upload.upload_url, {
        method: prepared.upload.upload_method || 'POST',
        body: uploadBody,
      });
      if (!uploadResponse.ok) {
        throw new Error('S3 did not accept the image upload.');
      }
      const completeResponse = await fetch(
        '/api/store/admin/product-media/complete',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product_id: productId,
            upload_token: prepared.upload.upload_token,
            alt_text: draft.name,
          }),
        }
      );
      const completed = await completeResponse.json();
      if (!completeResponse.ok || !completed.ok) {
        throw new Error(completed.error || 'Could not verify the upload.');
      }
      appendMedia(completed.media);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  function removeImage(index) {
    const item = draft.media[index];
    if (!item) return;
    const image = item.url || item.objectKey;
    setDraft((current) => ({
      ...current,
      media: current.media.filter((_, mediaIndex) => mediaIndex !== index),
      skuEntries: current.skuEntries.map((entry) =>
        entry.image === image ? { ...entry, image: '' } : entry
      ),
    }));
  }

  async function saveProduct() {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/store/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          create: draft._new,
          product: cleanPayload(draft),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Could not save the product.');
      }
      const saved = editableProduct(data.product);
      setDraft(saved);
      setSelectedId(saved.id);
      setBaseline(fingerprint(saved));
      setProducts((current) =>
        [
          ...current.filter((product) => product.id !== saved.id),
          data.product,
        ].sort(
          (left, right) =>
            Number(left.sortOrder || 0) - Number(right.sortOrder || 0) ||
            left.name.localeCompare(right.name)
        )
      );
      if (data.warning) {
        setError(data.warning);
      } else {
        setNotice(
          saved.status === 'live'
            ? 'Product saved and available to the storefront.'
            : `Product saved as ${saved.status}.`
        );
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout
      requiredPermission="products:read"
      hasUnsavedChanges={dirty}
      unsavedChangesMessage="Leave and discard the unsaved product changes?"
    >
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>Store operations</span>
            <h1>Products &amp; stock</h1>
            <p>
              One workspace for what customers see and what the team has on
              hand—from product storytelling and images to variant availability.
            </p>
          </div>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => {
              if (activeView !== 'catalog') showView('catalog');
              startNewProduct();
            }}
            disabled={!capabilities.canUpdate}
          >
            <AddRoundedIcon aria-hidden="true" />
            New product
          </button>
        </header>

        <nav className={styles.viewTabs} aria-label="Product workspace views">
          <button
            type="button"
            className={activeView === 'catalog' ? styles.viewTabActive : ''}
            onClick={() => showView('catalog')}
          >
            <span>Catalog</span>
            <small>Products, variants, images &amp; storefront</small>
          </button>
          <button
            type="button"
            className={activeView === 'stock' ? styles.viewTabActive : ''}
            onClick={() => showView('stock')}
          >
            <span>
              <Inventory2RoundedIcon aria-hidden="true" />
              Stock
            </span>
            <small>Counts, sold out, standby &amp; cleanup</small>
          </button>
        </nav>

        {error ? <div className={styles.error}>{error}</div> : null}
        {notice ? <div className={styles.success}>{notice}</div> : null}

        {activeView === 'catalog' ? (
          <>
            <div className={styles.stats}>
              <div><strong>{stats.live}</strong><span>Live</span></div>
              <div><strong>{stats.standby}</strong><span>Standby</span></div>
              <div><strong>{stats.draft}</strong><span>Drafts</span></div>
              <div><strong>{stats.skus}</strong><span>Active SKUs</span></div>
            </div>

            <div className={styles.workspace}>
              <aside className={styles.catalogList}>
                <div className={styles.listHeading}>
                  <strong>All products</strong>
                  <span>{products.length}</span>
                </div>
                {loading ? <p className={styles.empty}>Loading catalog…</p> : null}
                {!loading && !products.length ? (
                  <p className={styles.empty}>No products have been added yet.</p>
                ) : null}
                {catalogGroups.map((category) => (
                  <div className={styles.catalogGroup} key={category.category}>
                    <div className={styles.categoryHeading}>
                      <strong>{category.category}</strong>
                      <span>{category.productCount}</span>
                    </div>
                    {category.collections.map((collection) => (
                      <div
                        className={styles.collectionGroup}
                        key={`${category.category}-${collection.collection}`}
                      >
                        <div className={styles.collectionHeading}>
                          {collection.collection}
                        </div>
                        {collection.products.map((product) => (
                          <button
                            type="button"
                            key={product.id}
                            className={`${styles.productRow} ${
                              selectedId === product.id
                                ? styles.productRowActive
                                : ''
                            }`}
                            onClick={() => selectProduct(product)}
                          >
                            <span className={styles.productThumb}>
                              {product.image ? (
                                <img src={product.image} alt="" />
                              ) : null}
                            </span>
                            <span className={styles.productRowCopy}>
                              <strong>{product.name}</strong>
                              <small>
                                {product.skuEntries?.length || 0} variants ·{' '}
                                {money(product.price)}
                              </small>
                            </span>
                            <span
                              className={`${styles.status} ${
                                styles[product.status]
                              }`}
                            >
                              {product.status}
                            </span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </aside>

              <section className={styles.editor}>
                {!draft ? (
                  <div className={styles.editorEmpty}>
                    Select a product or create a new one.
                  </div>
                ) : (
                  <>
                <div className={styles.editorHeader}>
                  <div>
                    <span>
                      {draft.category} / {draft.collection} /{' '}
                      {draft._new ? 'New product' : 'Editing product'}
                    </span>
                    <h2>{draft.name || 'Untitled product'}</h2>
                  </div>
                  <div className={styles.editorActions}>
                    {!draft._new && draft.status === 'live' ? (
                      <a
                        href={`/store/${draft.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.secondaryButton}
                      >
                        <OpenInNewRoundedIcon aria-hidden="true" />
                        View
                      </a>
                    ) : null}
                    <button
                      type="button"
                      className={styles.primaryButton}
                      onClick={saveProduct}
                      disabled={!dirty || saving || uploading || !capabilities.canUpdate}
                    >
                      <SaveRoundedIcon aria-hidden="true" />
                      {saving ? 'Saving…' : 'Save product'}
                    </button>
                  </div>
                </div>

                <div className={styles.section}>
                  <div className={styles.sectionHeading}>
                    <div><span>01</span><h3>Storefront details</h3></div>
                    <p>The customer-facing name, story, placement, and state.</p>
                  </div>
                  <div className={styles.twoColumns}>
                    <Field label="Product name">
                      <input
                        value={draft.name}
                        onChange={(event) => {
                          const name = event.target.value;
                          updateProduct({
                            name,
                            ...(!draft._slugTouched
                              ? { slug: slugifyProduct(name) }
                              : {}),
                          });
                        }}
                      />
                    </Field>
                    <Field label="Store label" hint="The small category line above the product name.">
                      <input
                        value={draft.label}
                        onChange={(event) => updateProduct({ label: event.target.value })}
                      />
                    </Field>
                    <Field
                      label="Product category"
                      hint="Choose the shared storefront department for this product."
                    >
                      <select
                        value={draft.category}
                        onChange={(event) =>
                          updateProduct({ category: event.target.value })
                        }
                      >
                        {categoryOptions.map((category) => (
                          <option value={category} key={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field
                      label="Collection or maker"
                      hint="The line within that category, such as ReCaps."
                    >
                      <input
                        value={draft.collection}
                        onChange={(event) =>
                          updateProduct({ collection: event.target.value })
                        }
                        placeholder="ReCaps"
                      />
                    </Field>
                    <Field label="URL slug" hint={`/store/${draft.slug || 'product-name'}`}>
                      <input
                        value={draft.slug}
                        onChange={(event) =>
                          updateProduct({
                            slug: slugifyProduct(event.target.value),
                            _slugTouched: true,
                          })
                        }
                      />
                    </Field>
                    <Field label="Storefront position" hint="Lower numbers appear first.">
                      <input
                        type="number"
                        min="0"
                        value={draft.sortOrder}
                        onChange={(event) =>
                          updateProduct({ sortOrder: Number(event.target.value) })
                        }
                      />
                    </Field>
                  </div>
                  <Field label="Description">
                    <textarea
                      rows="6"
                      value={draft.description}
                      onChange={(event) =>
                        updateProduct({ description: event.target.value })
                      }
                    />
                  </Field>
                  <div className={styles.statusChooser}>
                    {Object.entries(STATUS_COPY).map(([status, copy]) => (
                      <label key={status}>
                        <input
                          type="radio"
                          name="product-status"
                          value={status}
                          checked={draft.status === status}
                          disabled={status === 'live' && !capabilities.canPublish}
                          onChange={() => updateProduct({ status })}
                        />
                        <span><strong>{status}</strong><small>{copy}</small></span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className={styles.section}>
                  <div className={styles.sectionHeading}>
                    <div><span>02</span><h3>Product structure & variants</h3></div>
                    <p>
                      Product type first, then color or size. Each final choice
                      has one SKU, price, inventory count, and customer image.
                    </p>
                  </div>
                  <div className={styles.optionLabels}>
                    {['style', 'color', 'size'].map((key) => (
                      <Field key={key} label={`${key} label`}>
                        <input
                          value={draft.optionLabels[key]}
                          onChange={(event) =>
                            updateProduct({
                              optionLabels: {
                                ...draft.optionLabels,
                                [key]: event.target.value,
                              },
                            })
                          }
                        />
                      </Field>
                    ))}
                  </div>
                  <div className={styles.structurePath}>
                    <span>{draft.category || 'Category'}</span>
                    <i>›</i>
                    <span>{draft.collection || 'Collection'}</span>
                    <i>›</i>
                    <strong>{draft.name || 'Product line'}</strong>
                  </div>
                  <div className={styles.variantWorkspace}>
                    <div className={styles.variantTree}>
                      {variantGroups.map((group) => (
                        <section className={styles.variantGroup} key={group.name}>
                          <div className={styles.variantGroupHeading}>
                            <span>{draft.optionLabels.style || 'Type'}</span>
                            <strong>{group.name}</strong>
                            <small>{group.entries.length}</small>
                          </div>
                          <div className={styles.variantChoices}>
                            {group.entries.map(({ entry, index }) => (
                              <button
                                type="button"
                                key={`${entry.sku}-${index}`}
                                className={`${styles.variantChoice} ${
                                  selectedVariantIndex === index
                                    ? styles.variantChoiceActive
                                    : ''
                                }`}
                                onClick={() => setSelectedVariantIndex(index)}
                              >
                                <span className={styles.variantChoiceImage}>
                                  {entry.image ? (
                                    <img src={entry.image} alt="" />
                                  ) : (
                                    <ImageRoundedIcon aria-hidden="true" />
                                  )}
                                </span>
                                <span>
                                  <strong>
                                    {variantTitle(entry, draft.optionLabels)}
                                  </strong>
                                  <small>
                                    {entry.sku} · {entry.quantity} in stock
                                  </small>
                                </span>
                                <span className={styles.variantChoiceBadges}>
                                  {index === 0 ? <em>Shown first</em> : null}
                                  {!entry.image ? <em>Needs image</em> : null}
                                </span>
                              </button>
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>

                    {selectedVariant ? (
                      <div className={styles.variantEditor}>
                        <div className={styles.variantToolbar}>
                          <div>
                            <span>Editing variant</span>
                            <strong>
                              {variantTitle(
                                selectedVariant,
                                draft.optionLabels
                              )}
                            </strong>
                          </div>
                          <div className={styles.variantOrderControls}>
                            {selectedVariantIndex === 0 ? (
                              <span className={styles.defaultVariantBadge}>
                                <CheckCircleRoundedIcon aria-hidden="true" />
                                Shown first
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  makeVariantDefault(selectedVariantIndex)
                                }
                              >
                                Make first
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                moveVariant(selectedVariantIndex, -1)
                              }
                              disabled={selectedVariantIndex === 0}
                              aria-label="Move variant earlier"
                            >
                              <ArrowUpwardRoundedIcon aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                moveVariant(selectedVariantIndex, 1)
                              }
                              disabled={
                                selectedVariantIndex ===
                                draft.skuEntries.length - 1
                              }
                              aria-label="Move variant later"
                            >
                              <ArrowDownwardRoundedIcon aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                        <div className={styles.shopperPreview}>
                          <span className={styles.previewEyebrow}>
                            Customer preview
                          </span>
                          <div className={styles.previewImage}>
                            {selectedVariant.image ? (
                              <img
                                src={selectedVariant.image}
                                alt={variantTitle(
                                  selectedVariant,
                                  draft.optionLabels
                                )}
                              />
                            ) : (
                              <div>
                                <ImageRoundedIcon aria-hidden="true" />
                                Choose an image below
                              </div>
                            )}
                          </div>
                          <div className={styles.previewCopy}>
                            <small>
                              {draft.category} / {draft.collection}
                            </small>
                            <strong>{draft.name || 'Untitled product'}</strong>
                            <span>
                              {variantTitle(
                                selectedVariant,
                                draft.optionLabels
                              )}
                            </span>
                            <b>{money(selectedVariant.price)}</b>
                          </div>
                        </div>

                        <div className={styles.variantMediaEditor}>
                          <div className={styles.variantMediaHeading}>
                            <div>
                              <strong>Photos for this variant</strong>
                              <span>
                                Click a thumbnail to make it primary. Check
                                Gallery for any additional customer photos.
                              </span>
                            </div>
                            <small>{draft.media.length} product photos</small>
                          </div>
                          <div className={styles.compactMediaRail}>
                            {draft.media.map((item, index) => {
                              const itemUrl = mediaUrl(item);
                              const isPrimary =
                                selectedVariant.image === itemUrl;
                              const isAssigned = (
                                item.assignedSkus || []
                              ).includes(selectedVariant.sku);

                              return (
                                <div
                                  className={`${styles.compactMediaItem} ${
                                    isPrimary
                                      ? styles.compactMediaPrimary
                                      : isAssigned
                                        ? styles.compactMediaAssigned
                                        : ''
                                  }`}
                                  key={item.assetId}
                                >
                                  <button
                                    type="button"
                                    className={styles.compactMediaImage}
                                    onClick={() => assignPrimaryImage(index)}
                                    aria-label={`Make photo ${index + 1} primary`}
                                  >
                                    <img
                                      src={itemUrl}
                                      alt={item.altText || draft.name}
                                    />
                                    {isPrimary ? (
                                      <span>Primary</span>
                                    ) : null}
                                  </button>
                                  <label>
                                    <input
                                      type="checkbox"
                                      checked={isAssigned}
                                      onChange={() =>
                                        toggleVariantGalleryImage(index)
                                      }
                                    />
                                    Gallery
                                  </label>
                                  <button
                                    type="button"
                                    className={styles.compactMediaRemove}
                                    onClick={() => removeImage(index)}
                                    aria-label={`Remove photo ${index + 1}`}
                                  >
                                    <DeleteOutlineRoundedIcon />
                                  </button>
                                </div>
                              );
                            })}
                            {!draft.media.length ? (
                              <div className={styles.noVariantMedia}>
                                <ImageRoundedIcon aria-hidden="true" />
                                Add the first photo for this variant.
                              </div>
                            ) : null}
                          </div>
                          <div className={styles.compactImageAddRow}>
                            <label className={styles.uploadButton}>
                              <UploadRoundedIcon aria-hidden="true" />
                              {uploading ? 'Uploading…' : 'Upload for variant'}
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/avif"
                                disabled={
                                  uploading ||
                                  !capabilities.canUpdateMedia ||
                                  !capabilities.mediaStorageConfigured
                                }
                                onChange={(event) => {
                                  uploadImage(event.target.files?.[0]);
                                  event.target.value = '';
                                }}
                              />
                            </label>
                            <input
                              value={imageUrl}
                              placeholder="Or paste an image URL"
                              onChange={(event) =>
                                setImageUrl(event.target.value)
                              }
                            />
                            <button
                              type="button"
                              className={styles.secondaryButton}
                              onClick={addExternalImage}
                              disabled={!imageUrl.trim()}
                            >
                              Add
                            </button>
                          </div>
                          {!capabilities.mediaStorageConfigured ? (
                            <p className={styles.hint}>
                              S3 uploads are not configured here. Existing paths
                              and image URLs still work.
                            </p>
                          ) : null}
                        </div>

                        <div className={styles.variantFields}>
                          <Field label="SKU" hint="Unique stock and Stripe identifier.">
                            <input
                              value={selectedVariant.sku}
                              onChange={(event) =>
                                updateVariant(selectedVariantIndex, {
                                  sku: event.target.value,
                                })
                              }
                              placeholder="unique-sku"
                            />
                          </Field>
                          <Field label="Customer-facing variant name">
                            <input
                              value={selectedVariant.label}
                              onChange={(event) =>
                                updateVariant(selectedVariantIndex, {
                                  label: event.target.value,
                                })
                              }
                              placeholder={draft.name || 'Product'}
                            />
                          </Field>
                          {['style', 'color', 'size'].map((key) => (
                            <Field
                              key={key}
                              label={draft.optionLabels[key] || key}
                              hint={
                                key === 'style'
                                  ? 'The product type grouping shown first.'
                                  : ''
                              }
                            >
                              <input
                                value={selectedVariant.options?.[key] || ''}
                                onChange={(event) =>
                                  updateVariantOption(
                                    selectedVariantIndex,
                                    key,
                                    event.target.value
                                  )
                                }
                              />
                            </Field>
                          ))}
                          <Field
                            label="Price"
                            hint="Enter dollars with up to two decimal places."
                          >
                            <div className={styles.moneyInput}>
                              <span>$</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                autoComplete="off"
                                value={
                                  selectedVariant._priceInput ??
                                  formatProductPriceInput(
                                    selectedVariant.price
                                  )
                                }
                                onFocus={(event) => event.target.select()}
                                onChange={(event) =>
                                  updateVariantPriceInput(
                                    selectedVariantIndex,
                                    event.target.value
                                  )
                                }
                                onBlur={(event) =>
                                  finishVariantPriceInput(
                                    selectedVariantIndex,
                                    event.target.value
                                  )
                                }
                              />
                            </div>
                          </Field>
                          <Field
                            label="Stock on hand"
                            hint="Enter a whole number."
                          >
                            <input
                              type="text"
                              inputMode="numeric"
                              autoComplete="off"
                              value={
                                selectedVariant._quantityInput ??
                                String(selectedVariant.quantity)
                              }
                              onFocus={(event) => event.target.select()}
                              onChange={(event) =>
                                updateVariantStockInput(
                                  selectedVariantIndex,
                                  event.target.value
                                )
                              }
                              onBlur={(event) =>
                                finishVariantStockInput(
                                  selectedVariantIndex,
                                  event.target.value
                                )
                              }
                            />
                          </Field>
                        </div>
                        <div className={styles.variantControls}>
                          <label>
                            <input
                              type="checkbox"
                              checked={
                                !selectedVariant.hidden &&
                                selectedVariant.active
                              }
                              onChange={(event) =>
                                updateVariant(selectedVariantIndex, {
                                  hidden: !event.target.checked,
                                  active: true,
                                })
                              }
                            />
                            Listed for customers
                          </label>
                          <button
                            type="button"
                            className={styles.removeVariantButton}
                            onClick={() =>
                              removeVariant(selectedVariantIndex)
                            }
                          >
                            <DeleteOutlineRoundedIcon aria-hidden="true" />
                            Remove variant
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className={styles.variantFooter}>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={addVariant}
                    >
                      <AddRoundedIcon aria-hidden="true" />
                      Add product variant
                    </button>
                    <button
                      type="button"
                      className={styles.textLink}
                      onClick={() => showView('stock')}
                    >
                      <Inventory2RoundedIcon aria-hidden="true" />
                      Review all stock
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
          </>
        ) : (
          <ProductStockWorkspace
            products={products}
            inventoryRows={inventoryRows}
            inventoryConfigured={capabilities.inventoryConfigured}
            canUpdateInventory={capabilities.canUpdateInventory}
            loading={loading}
            refreshDisabled={dirty}
            onRefresh={() => loadProducts(selectedId)}
            onEditProduct={editProductFromStock}
            onStockChange={handleStockChange}
            onOrphanRemoved={handleOrphanRemoved}
          />
        )}
      </div>
    </AdminLayout>
  );
}
