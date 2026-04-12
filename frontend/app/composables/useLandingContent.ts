// Static content shown on the landing page. Keeping it here means the
// page components stay focused on markup and the copy is easy to tweak
// without digging through JSX-style template soup.

export interface FeaturedProduct {
  name: string
  type: string
  price: string
  icon1: string
  spec1: string
  icon2: string
  spec2: string
  icon3: string
  spec3: string
  heroIcon: string
}

export interface LandingFeature {
  icon: string
  title: string
  desc: string
  bg: string
  hoverBg: string
  iconColor: string
}

export interface NavLink {
  label: string
  href: string
}

export interface StatCard {
  value: string
  title: string
  desc: string
  bg: string
  corner: string
}

export function useLandingContent() {
  const featuredProducts: FeaturedProduct[] = [
    { name: 'MacBook Pro M3', type: 'Laptop', price: '$25.00', icon1: 'ph:cpu', spec1: 'M3 Pro', icon2: 'ph:memory', spec2: '18GB', icon3: 'ph:hard-drive', spec3: '512GB', heroIcon: 'ph:laptop' },
    { name: 'Sony A7 IV', type: 'Camera', price: '$18.00', icon1: 'ph:aperture', spec1: '33MP', icon2: 'ph:film-strip', spec2: '4K 60', icon3: 'ph:crosshair', spec3: '693 AF', heroIcon: 'ph:camera' },
    { name: 'DJI Mavic 3', type: 'Drone', price: '$32.00', icon1: 'ph:timer', spec1: '46min', icon2: 'ph:video-camera', spec2: '5.1K', icon3: 'ph:wifi-high', spec3: '15km', heroIcon: 'ph:drone' },
    { name: 'iPad Pro M2', type: 'Tablet', price: '$15.00', icon1: 'ph:cpu', spec1: 'M2', icon2: 'ph:monitor', spec2: '12.9"', icon3: 'ph:pencil-simple', spec3: 'Pencil', heroIcon: 'ph:device-tablet' },
  ]

  const features: LandingFeature[] = [
    { icon: 'ph:lightning', title: 'Instant Delivery', desc: 'Get your tech delivered within hours. Same-day shipping available in 40+ cities nationwide.', bg: 'bg-surface-purple', hoverBg: 'group-hover:bg-primary-100', iconColor: 'text-primary-500' },
    { icon: 'ph:shield-check', title: 'Premium Protection', desc: 'Every rental includes full coverage insurance. No hidden fees, no surprises — just peace of mind.', bg: 'bg-surface-violet', hoverBg: 'group-hover:bg-accent-200', iconColor: 'text-accent-500' },
    { icon: 'ph:devices', title: 'Wide Catalog', desc: '250+ premium devices from laptops and cameras to drones and tablets — always the latest models.', bg: 'bg-surface-lavender', hoverBg: 'group-hover:bg-primary-100', iconColor: 'text-primary-600' },
    { icon: 'ph:arrows-clockwise', title: 'Flexible Returns', desc: 'Extend your rental or return early — no penalties. Schedule pickup at your convenience.', bg: 'bg-surface-lilac', hoverBg: 'group-hover:bg-primary-100', iconColor: 'text-primary-700' },
  ]

  const navLinks: NavLink[] = [
    { label: 'Products', href: '/products' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Pricing', href: '#pricing' },
  ]

  const statCards: StatCard[] = [
    { value: '250+', title: 'Products', desc: 'Laptops, cameras, drones, and more.', bg: 'bg-surface-purple', corner: 'rounded-tl-feature' },
    { value: '40+', title: 'Cities', desc: 'Same-day delivery across major cities.', bg: 'bg-surface-lilac', corner: 'rounded-tr-feature' },
    { value: '10K+', title: 'Users', desc: 'Active renters on the platform.', bg: 'bg-surface-lavender', corner: 'rounded-bl-feature' },
    { value: '4.9', title: 'Rating', desc: 'Average user satisfaction score.', bg: 'bg-surface-violet', corner: 'rounded-br-feature' },
  ]

  return { featuredProducts, features, navLinks, statCards }
}
