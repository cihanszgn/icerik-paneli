import { PostsClient } from './posts-client'
import { Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'  // varsa, yoksa basit checkbox yaz
import { useState } from 'react'

export default function PostsPage() {
  return <PostsClient />
}
