import re

# Read the file
with open(r'c:\Users\Admin\scrappy-v2\app\generated-links\page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix copyToClipboard function
old_copy_to_clipboard = r'''  const copyToClipboard = \(text: string\) => \{
    navigator\.clipboard\.writeText\(text\)
    setCopiedLinks\(prev => new Set\(\[\.\.\.prev, text\]\)\)
    
    // Show toast notification
    const toast = document\.createElement\('div'\)
    toast\.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in'
    toast\.textContent = '✅ Link copied to clipboard!'
    document\.body\.appendChild\(toast\)
    setTimeout\(\(\) => \{
      toast\.classList\.add\('animate-fade-out'\)
      setTimeout\(\(\) => document\.body\.removeChild\(toast\), 300\)
    \}, 2000\)
  \}'''

new_copy_to_clipboard = '''  const copyToClipboard = async (text: string, linkId?: string) => {
    navigator.clipboard.writeText(text)
    setCopiedLinks(prev => new Set([...prev, text]))
    
    // Update database if we have a link ID
    if (linkId && supabase && country) {
      const tableName = country === 'usa' ? 'us_sellers' : `${country}_sellers`
      try {
        await supabase
          .from(tableName)
          .update({ is_copied: true })
          .eq('id', linkId)
      } catch (error) {
        console.error('Error marking link as copied:', error)
      }
    }
    
    // Show toast notification
    const toast = document.createElement('div')
    toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in'
    toast.textContent = '✅ Link copied to clipboard!'
    document.body.appendChild(toast)
    setTimeout(() => {
      toast.classList.add('animate-fade-out')
      setTimeout(() => document.body.removeChild(toast), 300)
    }, 2000)
  }'''

content = re.sub(old_copy_to_clipboard, new_copy_to_clipboard, content, flags=re.MULTILINE)

# Fix copyAllLinks function  
old_copy_all = r'''  const copyAllLinks = async \(\) => \{
    const totalLinks = links\.length
    if \(totalLinks === 0\) return

    setCopyProgress\(\{ isActive: true, current: 0, total: totalLinks \}\)

    // Collect all links
    const allLinksText = links\.map\(link => link\.profile_link\)\.join\('\\n'\)
    
    // Copy to clipboard
    await navigator\.clipboard\.writeText\(allLinksText\)

    // Simulate progress for visual feedback
    for \(let i = 0; i <= totalLinks; i \+= Math\.ceil\(totalLinks / 20\)\) \{
      await new Promise\(resolve => setTimeout\(resolve, 50\)\)
      setCopyProgress\(\{ isActive: true, current: Math\.min\(i, totalLinks\), total: totalLinks \}\)
    \}

    // Mark all as copied
    setCopiedLinks\(new Set\(links\.map\(link => link\.profile_link\)\)\)

    // Complete
    setCopyProgress\(\{ isActive: true, current: totalLinks, total: totalLinks \}\)
    
    setTimeout\(\(\) => \{
      setCopyProgress\(\{ isActive: false, current: 0, total: 0 \}\)
      
      // Show success toast
      const toast = document\.createElement\('div'\)
      toast\.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50'
      toast\.textContent = `✅ Copied \$\{totalLinks\} links to clipboard!`
      document\.body\.appendChild\(toast\)
      setTimeout\(\(\) => document\.body\.removeChild\(toast\), 3000\)
    \}, 500\)
  \}'''

new_copy_all = '''  const copyAllLinks = async () => {
    const totalLinks = links.length
    if (totalLinks === 0 || !supabase || !country) return

    setCopyProgress({ isActive: true, current: 0, total: totalLinks })

    try {
      // Collect all links
      const allLinksText = links.map(link => link.profile_link).join('\\n')
      
      // Copy to clipboard
      await navigator.clipboard.writeText(allLinksText)

      // Mark all as copied in database with progress tracking
      const tableName = country === 'usa' ? 'us_sellers' : `${country}_sellers`
      const linkIds = links.filter(link => link.id).map(link => link.id!)
      
      if (linkIds.length > 0) {
        // Update in batches for better performance and progress tracking
        const batchSize = 100
        for (let i = 0; i < linkIds.length; i += batchSize) {
          const batch = linkIds.slice(i, i + batchSize)
          
          await supabase
            .from(tableName)
            .update({ is_copied: true })
            .in('id', batch)
          
          // Update progress
          const current = Math.min(i + batchSize, totalLinks)
          setCopyProgress({ isActive: true, current, total: totalLinks })
          
          // Small delay for visual feedback
          await new Promise(resolve => setTimeout(resolve, 50))
        }
      }

      // Mark all as copied locally
      setCopiedLinks(new Set(links.map(link => link.profile_link)))

      // Complete
      setCopyProgress({ isActive: true, current: totalLinks, total: totalLinks })
      
      setTimeout(() => {
        setCopyProgress({ isActive: false, current: 0, total: 0 })
        
        // Show success toast
        const toast = document.createElement('div')
        toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50'
        toast.textContent = `✅ Copied ${totalLinks} links to clipboard and marked in database!`
        document.body.appendChild(toast)
        setTimeout(() => document.body.removeChild(toast), 3000)
      }, 500)
    } catch (error) {
      console.error('Error in copyAllLinks:', error)
      setCopyProgress({ isActive: false, current: 0, total: 0 })
      
      // Show error toast
      const toast = document.createElement('div')
      toast.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50'
      toast.textContent = '❌ Error copying links. Please try again.'
      document.body.appendChild(toast)
      setTimeout(() => document.body.removeChild(toast), 3000)
    }
  }'''

content = re.sub(old_copy_all, new_copy_all, content, flags=re.MULTILINE | re.DOTALL)

# Fix the copy button call to pass linkId
content = content.replace(
    "copyToClipboard(link.profile_link)",
    "copyToClipboard(link.profile_link, link.id)"
)

# Write back
with open(r'c:\Users\Admin\scrappy-v2\app\generated-links\page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("File updated successfully!")
