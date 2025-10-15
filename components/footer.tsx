
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import Link from 'next/link';
import Image from "next/image";
import piLogo from "@/public/pi-logo-full.svg";

export function Footer() {
  return (
    <div className={'border-t p-6 py-8 bg-white'}>
      <div className={'mx-auto max-w-6xl'}>
        <div className={'flex flex-wrap items-end gap-5 text-sm text-gray-600'}>
          <Image className={'w-24'} src={piLogo} alt={"Pi Labs logo"}/>
          <Link className={'hover:text-gray-800'} href={'/'}>
            Home
          </Link>
          <Link className={'hover:text-gray-800'} href={'https://code.withpi.ai/introduction'}>
            Docs
          </Link>
          <Link className={'hover:text-gray-800'} href={'https://withpi.ai/pricing'}>
            Pricing
          </Link>
          <Link className={'hover:text-gray-800'} href={'https://withpi.ai//support'}>
            Support
          </Link>
          <Link className={'hover:text-gray-800'} href={'https://withpi.ai/status'}>
            Status
          </Link>
          <Menu>
            <MenuButton className={'flex items-center gap-2'}>
              Legal
            </MenuButton>
            <MenuItems className={'rounded-md border bg-white p-2'} anchor="top">
              <MenuItem>
                <Link
                  className="block p-2 px-3 text-sm font-semibold hover:bg-gray-100 data-focus:bg-blue-100"
                  href="https://withpi.ai/legal-pages/privacy-policy"
                >
                  Privacy Policy
                </Link>
              </MenuItem>
              <MenuItem>
                <Link
                  className="block p-2 px-3 text-sm font-semibold hover:bg-gray-100 data-focus:bg-blue-100"
                  href="https://withpi.ai/legal-pages/terms-of-service"
                >
                  Terms of Service
                </Link>
              </MenuItem>
            </MenuItems>
          </Menu>
        </div>
        <div className={'mt-6 text-xs text-gray-400'}>© 2025, Pi Labs Inc.</div>
      </div>
    </div>
  );
}
