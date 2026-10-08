export function ProductBrand({ compact = false }: { compact?: boolean }) {
  return (
    <a href="https://digitalburj.com/business-os" target="_blank" rel="noopener noreferrer"
      className={compact ? 'product-brand product-brand-compact' : 'product-brand'}
      aria-label="A product of DigitalBurj Business OS">
      <span>A product of</span>
      <img src="/brand/digitalburj-business-os.png" alt="DigitalBurj Business OS" width="160" height="64" />
    </a>
  )
}
