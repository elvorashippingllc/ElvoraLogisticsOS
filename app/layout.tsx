import type { Metadata } from 'next';
import './globals.css';
import './operations.css';
export const metadata:Metadata={title:'DigitalBurj ElvoraOS · Freight operations',description:'Elvora Shipping operations, commercial control and shipment finance, powered by DigitalBurj Business OS.',robots:{index:false,follow:false},icons:{icon:'/brand/digitalburj-business-os-mark.webp',shortcut:'/brand/digitalburj-business-os-mark.webp'},manifest:'/manifest.webmanifest'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
