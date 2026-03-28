import clsx from 'clsx'
import { ListMusic } from 'lucide-react'
import { memo } from 'react'
import { Link } from 'react-router-dom'
import { EqualizerBars } from '@/app/components/icons/equalizer-bars'
import { PlaylistOptions } from '@/app/components/playlist/options'
import { ContextMenuProvider } from '@/app/components/table/context-menu'
import {
  MainSidebarMenuButton,
  MainSidebarMenuItem,
} from '@/app/components/ui/main-sidebar'
import { useRouteIsActive } from '@/app/hooks/use-route-is-active'
import { ROUTES } from '@/routes/routesList'
import { usePlayerActions, usePlayerIsPlaying } from '@/store/player.store'
import { Playlist } from '@/types/responses/playlist'

const MemoContextMenuProvider = memo(ContextMenuProvider)
const MemoPlaylistOptions = memo(PlaylistOptions)

interface SidebarPlaylistItemProps {
  playlist: Playlist
}

export function SidebarPlaylistItem({ playlist }: SidebarPlaylistItemProps) {
  const { isOnPlaylist } = useRouteIsActive()
  const isPlaying = usePlayerIsPlaying()
  const { isPlaylistActive } = usePlayerActions()

  const isCurrentPlaying = isPlaylistActive(playlist.id) && isPlaying

  return (
    <MainSidebarMenuItem>
      <MemoContextMenuProvider
        options={
          <MemoPlaylistOptions
            variant="context"
            playlist={playlist}
            showPlay={true}
          />
        }
      >
        <MainSidebarMenuButton
          asChild
          className={clsx(
            isOnPlaylist(playlist.id) && 'cursor-default',
            isOnPlaylist(playlist.id) && !isPlaying && 'bg-accent',
            isCurrentPlaying && 'text-primary',
          )}
        >
          <Link
            to={ROUTES.PLAYLIST.PAGE(playlist.id)}
            onClick={(e) => {
              if (isOnPlaylist(playlist.id)) {
                e.preventDefault()
              }
            }}
          >
            {isCurrentPlaying ? (
              <EqualizerBars className="text-primary mb-1" />
            ) : (
              <ListMusic />
            )}
            <span className="truncate">{playlist.name}</span>
          </Link>
        </MainSidebarMenuButton>
      </MemoContextMenuProvider>
    </MainSidebarMenuItem>
  )
}
