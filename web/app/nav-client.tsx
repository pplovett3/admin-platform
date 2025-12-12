"use client";
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { parseJwt, getToken, Role } from '@/app/_utils/auth';
import { Menu } from 'antd';
import {
	TeamOutlined,
	CrownOutlined,
	ReadOutlined,
	ApartmentOutlined,
	ExperimentOutlined,
	FileOutlined,
	SafetyOutlined,
	KeyOutlined,
	UnorderedListOutlined,
	TrophyOutlined,
} from '@ant-design/icons';
import { usePathname } from 'next/navigation';

export default function ClientNav() {
	const [role, setRole] = useState<Role | undefined>(undefined);
	const [metaverseAllowed, setMetaverseAllowed] = useState<boolean>(false);
	const pathname = usePathname();

	useEffect(() => {
		const token = getToken();
		const payload: any = parseJwt(token as any);
		setRole(payload?.role);
		setMetaverseAllowed(!!payload?.metaverseAllowed);
	}, []);

	const items = useMemo(() => {
		const list: any[] = [];

		if (role === 'superadmin') {
			list.push({ key: '/admin/analytics', icon: <ExperimentOutlined />, label: <Link href="/admin/analytics">数据总览</Link> });
		}
		if (role === 'schoolAdmin' || role === 'teacher' || role === 'student') {
			list.push({ key: '/analytics', icon: <ExperimentOutlined />, label: <Link href="/analytics">数据总览</Link> });
		}

		list.push({ key: '/activate', icon: <KeyOutlined />, label: <Link href="/activate">激活课程</Link> });

		if (role === 'superadmin' || role === 'schoolAdmin' || role === 'teacher') {
			list.push({ key: '/users', icon: <TeamOutlined />, label: <Link href="/users">用户管理</Link> });
		}
		list.push({ key: '/scores', icon: <ExperimentOutlined />, label: <Link href="/scores">成绩查看</Link> });
		if (role === 'superadmin' || role === 'schoolAdmin') {
			list.push({ key: '/admin/classes', icon: <ApartmentOutlined />, label: <Link href="/admin/classes">班级管理</Link> });
		}
		if (role === 'superadmin') {
			list.push({ key: '/admin/schools', icon: <CrownOutlined />, label: <Link href="/admin/schools">学校管理</Link> });
			list.push({ key: '/admin/courses', icon: <ReadOutlined />, label: <Link href="/admin/courses">课程管理</Link> });
			list.push({ key: '/admin/three-courseware', icon: <FileOutlined />, label: <Link href="/admin/three-courseware">三维课件</Link> });
			list.push({ key: '/admin/ai-course', icon: <ReadOutlined />, label: <Link href="/admin/ai-course">AI课程编辑</Link> });
			list.push({ key: '/metaverse/authorize', icon: <SafetyOutlined />, label: <Link href="/metaverse/authorize">元宇宙大厅授权</Link> });
		}
		if (role === 'superadmin' || metaverseAllowed) {
			list.push({ key: '/resources', icon: <FileOutlined />, label: <Link href="/resources">资源管理</Link> });
		}
		if (role === 'superadmin' || role === 'schoolAdmin' || role === 'teacher') {
			list.push({ key: '/admin/quiz-records', icon: <TrophyOutlined />, label: <Link href="/admin/quiz-records">成绩管理</Link> });
		}
		if (role === 'superadmin') {
			list.push({ key: '/admin/activation-codes', icon: <KeyOutlined />, label: <Link href="/admin/activation-codes">激活码管理</Link> });
			list.push({ key: '/admin/activations', icon: <UnorderedListOutlined />, label: <Link href="/admin/activations">激活记录</Link> });
		}
		return list;
	}, [role, metaverseAllowed]);

	return (
		<div
			style={{
				width: 240,
				position: 'fixed',
				left: 0,
				top: 0,
				bottom: 0,
				height: '100vh',
				display: 'flex',
				flexDirection: 'column',
				// 半透明毛玻璃 + 浅蓝边框发光
				background: 'linear-gradient(180deg, rgba(13, 21, 32, 0.75) 0%, rgba(10, 16, 24, 0.7) 100%)',
				backdropFilter: 'blur(20px) saturate(150%)',
				WebkitBackdropFilter: 'blur(20px) saturate(150%)',
				borderRight: '1px solid rgba(34, 211, 238, 0.15)',
				boxShadow: '1px 0 30px rgba(34, 211, 238, 0.05)',
				zIndex: 100
			}}
		>
			
			{/* Logo区域 */}
			<div style={{ 
				padding: '20px 18px', 
				borderBottom: '1px solid rgba(34, 211, 238, 0.1)',
				position: 'relative'
			}}>
				<div style={{ 
					fontWeight: 700, 
					fontSize: 18,
					letterSpacing: 1, 
					color: '#fff'
				}}>
					CollabXR平台
				</div>
				<div style={{
					fontSize: 11,
					color: 'rgba(148, 163, 184, 0.5)',
					marginTop: 4,
					letterSpacing: 0.5
				}}>
					内容管理系统
				</div>
			</div>
			
			{/* 菜单 */}
			<Menu
				mode="inline"
				items={items}
				style={{ 
					borderRight: 0, 
					flex: 1, 
					background: 'transparent',
					padding: '8px 0'
				}}
				selectedKeys={[pathname || '/']}
			/>
			
			{/* 底部版本信息 */}
			<div style={{ 
				padding: '16px 18px', 
				borderTop: '1px solid rgba(34, 211, 238, 0.1)',
				fontSize: 11,
				color: 'rgba(148, 163, 184, 0.4)',
				textAlign: 'center'
			}}>
				v2.0.0 · Liquid Glass UI
			</div>
		</div>
	);
}
