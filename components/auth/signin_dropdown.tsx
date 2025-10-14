
'use client';

import {
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
} from '@/components/ui/dropdown';
import { ArrowRightStartOnRectangleIcon, CogIcon, KeyIcon } from '@heroicons/react/16/solid';
import { signOut } from 'next-auth/react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { User } from 'next-auth';
import { Squares2X2Icon } from '@heroicons/react/24/solid';

export function UserDropdown({ user }: { user: User }) {
  async function logout() {
    await signOut({ redirect: true, redirectTo: '/' });
  }
  return (
    <Dropdown>
      <DropdownButton color={'white'}>
        <span className="flex min-w-0 items-center gap-3">
          <div
            className={'to-dark-brown-50 h-4 w-4 rounded-full bg-linear-to-tr from-purple-400'}
          />
          <span className="min-w-0">
            <span className="block truncate text-sm/5 font-medium text-zinc-950 dark:text-white">
              {user?.name}
            </span>
          </span>
        </span>
        <ChevronDownIcon />
      </DropdownButton>

      <DropdownMenu className="z-30 min-w-64" anchor="top start">
        <DropdownItem href={`/projects`}>
          <Squares2X2Icon className={'w-4'} />
          <DropdownLabel>Projects</DropdownLabel>
        </DropdownItem>
        <DropdownItem href={`/account/keys`}>
          <KeyIcon />
          <DropdownLabel>API Keys</DropdownLabel>
        </DropdownItem>
        <DropdownItem href={`/account`}>
          <CogIcon />
          <DropdownLabel>Settings</DropdownLabel>
        </DropdownItem>
        <DropdownDivider />
        <DropdownItem onClick={logout}>
          <ArrowRightStartOnRectangleIcon />
          <DropdownLabel>Sign out</DropdownLabel>
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
}
