'use client';

import { signOutAction } from '@/app/actions';
import { AppHeader } from '@/components/AppHeader';
import { ADMIN_ITEM, isActivePath, NAV_ITEMS, PROFILE_ITEM } from '@/components/nav';
import { ThemeToggle } from '@/components/ThemeToggle';
import { focusRing, trackVar } from '@/components/track';
import { openSearch } from '@/lib/searchBus';
import { cn } from '@/lib/utils';
import { LogOut, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export type TopBarUser = { name: string; image?: string; isAdmin: boolean };

const linkClass = (active: boolean) =>
	cn(
		'inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground lg:px-2.5',
		focusRing,
		active ? 'bg-muted text-foreground' : 'text-muted-foreground',
	);

const barClass = (active: boolean) =>
	cn(
		'pointer-events-none absolute inset-x-2 -bottom-px h-0.5 origin-left rounded-full bg-ring transition-transform duration-300 ease-out peer-hover:scale-x-100 lg:inset-x-3',
		active ? 'scale-x-100' : 'scale-x-0',
	);

const menuItemClass =
	'flex w-full items-center gap-2 rounded-md px-2 py-1.5 pointer-coarse:py-2.5 text-left text-sm text-muted-foreground hover:bg-muted hover:pl-3 hover:text-foreground';

export function TopBar({ user }: { user: TopBarUser }) {
	const pathname = usePathname();
	const [accountOpen, setAccountOpen] = useState(false);
	const accountRef = useRef<HTMLDivElement>(null);
	const accountButtonRef = useRef<HTMLButtonElement>(null);

	const [shownPath, setShownPath] = useState(pathname);
	if (shownPath !== pathname) {
		setShownPath(pathname);
		setAccountOpen(false);
	}

	useEffect(() => {
		if (!accountOpen) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== 'Escape') return;
			accountButtonRef.current?.focus();
			setAccountOpen(false);
		};
		const onPointer = (e: PointerEvent) => {
			if (accountRef.current && !accountRef.current.contains(e.target as Node))
				setAccountOpen(false);
		};
		document.addEventListener('keydown', onKey);
		document.addEventListener('pointerdown', onPointer);
		return () => {
			document.removeEventListener('keydown', onKey);
			document.removeEventListener('pointerdown', onPointer);
		};
	}, [accountOpen]);

	return (
		<AppHeader logoHref="/dashboard">
			<nav
				aria-label="Main"
				className="hidden min-w-0 flex-1 gap-1 self-stretch overflow-x-auto overflow-y-hidden lg:flex"
			>
				{NAV_ITEMS.filter((i) => i.href !== '/dashboard').map(({ href, label, icon: Glyph, track }) => {
					const active = isActivePath(pathname, href);
					return (
						<div
							key={href}
							className="relative flex shrink-0 items-center"
						>
							<Link
								href={href}
								aria-current={active ? 'page' : undefined}
								className={cn(linkClass(active), 'peer')}
							>
								<Glyph
									aria-hidden
									className="size-4 shrink-0"
									style={
										track && active ? { color: trackVar(track) } : undefined
									}
								/>
								{label}
							</Link>
							<span
								aria-hidden
								className={barClass(active)}
							/>
						</div>
					);
				})}
			</nav>

			<div className="ml-auto flex shrink-0 items-center gap-1">
				<button
					type="button"
					onClick={openSearch}
					aria-label="Search"
					aria-keyshortcuts="Control+K Meta+K"
					className={cn(
						'inline-flex h-9 items-center gap-2 rounded-md px-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:border lg:border-border lg:bg-background lg:pr-1.5 lg:pl-2.5 pointer-coarse:h-10',
						focusRing,
					)}
				>
					<Search
						className="size-4 shrink-0"
						aria-hidden
					/>
					<span
						aria-hidden
						className="hidden text-sm lg:inline"
					>
						Search
					</span>
					<kbd
						aria-hidden
						className="ml-3 hidden rounded border border-border px-1.5 py-0.5 text-[0.6875rem] font-sans tabular-nums xl:inline"
					>
						⌘K
					</kbd>
				</button>
				<ThemeToggle />
				<div
					ref={accountRef}
					className="relative"
					onBlur={(e) => {
						if (
							accountOpen &&
							!e.currentTarget.contains(e.relatedTarget as Node | null)
						)
							setAccountOpen(false);
					}}
				>
					<button
						ref={accountButtonRef}
						type="button"
						aria-label="Account menu"
						aria-expanded={accountOpen}
						onClick={() => setAccountOpen((open) => !open)}
						className={cn(
							'flex size-9 pointer-coarse:size-10 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-sm font-semibold transition-shadow hover:ring-2 hover:ring-ring/40 aria-expanded:ring-2 aria-expanded:ring-ring/60',
							focusRing,
						)}
					>
						{user.image ? (
							// eslint-disable-next-line @next/next/no-img-element -- Google avatar host; next/image would need a remote pattern
							<img
								src={user.image}
								alt=""
								referrerPolicy="no-referrer"
								className="size-full object-cover"
							/>
						) : (
							<span aria-hidden>
								{(user.name.trim()[0] ?? '?').toUpperCase()}
							</span>
						)}
					</button>
					{accountOpen && (
						<div className="absolute right-0 top-11 w-56 origin-top-right rounded-lg border border-border bg-popover p-2 shadow-md animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 duration-150">
							<p className="truncate px-2 py-1.5 text-sm font-medium">
								{user.name}
							</p>
							<Link
								href="/profile"
								onClick={() => setAccountOpen(false)}
								className={menuItemClass}
							>
								<PROFILE_ITEM.icon
									aria-hidden
									className="size-4 shrink-0"
								/>
								{PROFILE_ITEM.label}
							</Link>
							{user.isAdmin && (
								<Link
									href={ADMIN_ITEM.href}
									onClick={() => setAccountOpen(false)}
									className={menuItemClass}
								>
									<ADMIN_ITEM.icon
										aria-hidden
										className="size-4 shrink-0"
									/>
									{ADMIN_ITEM.label}
								</Link>
							)}
							<form action={signOutAction}>
								<button
									type="submit"
									className={menuItemClass}
								>
									<LogOut
										aria-hidden
										className="size-4 shrink-0"
									/>
									Sign out
								</button>
							</form>
						</div>
					)}
				</div>
			</div>
		</AppHeader>
	);
}
