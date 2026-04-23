import { CachesContent } from './caches'
import { FeatureContent } from './features'
import { PodcastContent } from './podcast'
import { SidebarContent } from './sidebar'

export function Content() {
  return (
    <div className="space-y-4">
      <SidebarContent />
      <FeatureContent />
      <PodcastContent />
      <CachesContent />
    </div>
  )
}
