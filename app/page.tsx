import { getChatGPTUser } from './chatgpt-auth';
import ElvoraOS from '@/components/elvora-os';
export const dynamic='force-dynamic';
export default async function Page(){const user=await getChatGPTUser();return <ElvoraOS user={user?{email:user.email,name:user.displayName}:null}/>;}
