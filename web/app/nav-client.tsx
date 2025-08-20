"use client";
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { parseJwt, getToken, Role } from '@/app/_utils/auth';
import { Switch, Typography, Menu } from 'antd';
import { useUiTheme } from './providers';
import {
	TeamOutlined,
	CrownOutlined,
	ReadOutlined,
	ApartmentOutlined,
	DeploymentUnitOutlined,
	ExperimentOutlined,
	FileOutlined,
	SafetyOutlined,
} from '@ant-design/icons';
import { usePathname } from 'next/navigation';

export default function ClientNav() {
	const [role, setRole] = useState<Role | undefined>(undefined);
	const [metaverseAllowed, setMetaverseAllowed] = useState<boolean>(false);
	const { uiTheme, setUiTheme } = useUiTheme();
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
			// 元宇宙大厅授权（仅超管）
			list.push({ key: '/metaverse/authorize', icon: <SafetyOutlined />, label: <Link href="/metaverse/authorize">元宇宙大厅授权</Link> });
		}
		// 资源管理：超管默认显示；其他用户仅在被授权后显示
		if (role === 'superadmin' || metaverseAllowed) {
			list.push({ key: '/resources', icon: <FileOutlined />, label: <Link href="/resources">资源管理</Link> });
		}
		if (role === 'superadmin' || role === 'schoolAdmin') {
			list.push({ key: '/admin/enrollments', icon: <DeploymentUnitOutlined />, label: <Link href="/admin/enrollments">课程分配</Link> });
		}
		return list;
	}, [role, metaverseAllowed]);

	return (
		<div
			style={{
				width: 220,
				position: 'fixed',
				left: 0,
				top: 0,
				bottom: 0,
				height: '100vh',
				display: 'flex',
				flexDirection: 'column',
				background: uiTheme === 'dark' ? 'linear-gradient(180deg, #0e1730 0%, #0b1220 100%)' : '#FFFFFF',
				borderRight: uiTheme === 'dark' ? '1px solid rgba(255,255,255,0.06)' : '1px solid #E0DEEA'
			}}
		>
			<div style={{ padding: '16px 14px', borderBottom: uiTheme === 'dark' ? '1px solid rgba(255,255,255,0.06)' : '1px solid #E0DEEA' }}>
				<Typography.Text style={{ fontWeight: 800, letterSpacing: 0.6, color: uiTheme === 'dark' ? '#e2e8f0' : '#0f172a' }}>YF课程管理平台</Typography.Text>
			</div>
			<Menu
				mode="inline"
				items={items}
				style={{ borderRight: 0, flex: 1, background: 'transparent' }}
				selectedKeys={[pathname || '/']}
			/>
			<div style={{ padding: 12, borderTop: uiTheme === 'dark' ? '1px solid rgba(255,255,255,0.06)' : '1px solid #E0DEEA' }}>
				<span style={{ marginRight: 8 }}>亮色</span>
				<Switch checked={uiTheme === 'dark'} onChange={(v) => setUiTheme(v ? 'dark' : 'light')} />
				<span style={{ marginLeft: 8 }}>暗色</span>
			</div>
		</div>
	);
} 