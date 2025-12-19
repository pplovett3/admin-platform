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
	BarChartOutlined,
	AuditOutlined,
	AppstoreOutlined,
} from '@ant-design/icons';
import { usePathname } from 'next/navigation';
import type { MenuProps } from 'antd';

type MenuItem = Required<MenuProps>['items'][number];

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
		const list: MenuItem[] = [];

		// ========== 数据分析模块 ==========
		if (role === 'superadmin') {
			list.push({
				key: 'analytics-group',
				label: '数据分析',
				type: 'group',
				children: [
					{ key: '/admin/analytics', icon: <BarChartOutlined />, label: <Link href="/admin/analytics">数据总览</Link> },
				],
			});
		}
		if (role === 'schoolAdmin' || role === 'teacher') {
			list.push({
				key: 'analytics-group',
				label: '数据分析',
				type: 'group',
				children: [
					{ key: '/analytics', icon: <BarChartOutlined />, label: <Link href="/analytics">数据总览</Link> },
					{ key: '/scores', icon: <ExperimentOutlined />, label: <Link href="/scores">成绩查看</Link> },
				],
			});
		}

		// ========== 用户管理模块 ==========
		const userManagementItems: MenuItem[] = [];
		
		// 组织管理
		if (role === 'superadmin') {
			userManagementItems.push(
				{ key: '/admin/schools', icon: <CrownOutlined />, label: <Link href="/admin/schools">学校管理</Link> }
			);
		}
		if (role === 'superadmin' || role === 'schoolAdmin') {
			userManagementItems.push(
				{ key: '/admin/classes', icon: <ApartmentOutlined />, label: <Link href="/admin/classes">班级管理</Link> }
			);
		}
		
		// 人员管理
		if (role === 'superadmin' || role === 'schoolAdmin' || role === 'teacher') {
			userManagementItems.push(
				{ key: '/users', icon: <TeamOutlined />, label: <Link href="/users">人员管理</Link> }
			);
		}
		
		if (userManagementItems.length > 0) {
			list.push({
				key: 'user-group',
				label: '用户管理',
				type: 'group',
				children: userManagementItems,
			});
		}

		// ========== 课程管理模块 ==========
		const courseManagementItems: MenuItem[] = [];

		if (role === 'superadmin' || role === 'schoolAdmin') {
			courseManagementItems.push(
				{ key: '/admin/courses', icon: <ReadOutlined />, label: <Link href="/admin/courses">虚拟仿真课程</Link> },
				{ key: '/admin/course-review', icon: <AuditOutlined />, label: <Link href="/admin/course-review">课件审核</Link> }
			);
		}

		if (role === 'superadmin' || role === 'schoolAdmin' || role === 'teacher') {
			courseManagementItems.push(
				{ key: '/admin/quiz-records', icon: <TrophyOutlined />, label: <Link href="/admin/quiz-records">成绩管理</Link> }
			);
		}

		if (courseManagementItems.length > 0) {
			list.push({
				key: 'course-group',
				label: '课程管理',
				type: 'group',
				children: courseManagementItems,
			});
		}

		// ========== 课程授权模块 (仅超管) ==========
		if (role === 'superadmin') {
			list.push({
				key: 'auth-group',
				label: '课程授权',
				type: 'group',
				children: [
					{ key: '/admin/activation-codes', icon: <KeyOutlined />, label: <Link href="/admin/activation-codes">激活码管理</Link> },
					{ key: '/admin/activations', icon: <UnorderedListOutlined />, label: <Link href="/admin/activations">激活记录</Link> },
					{ key: '/metaverse/authorize', icon: <SafetyOutlined />, label: <Link href="/metaverse/authorize">元宇宙大厅授权</Link> },
				],
			});
		}

		// ========== 快捷入口 ==========
		const quickAccessItems: MenuItem[] = [];
		
		quickAccessItems.push(
			{ key: '/activate', icon: <KeyOutlined />, label: <Link href="/activate">激活课程</Link> }
		);

		if (role === 'superadmin' || role === 'schoolAdmin' || role === 'teacher') {
			quickAccessItems.push(
				{ key: '/editor', icon: <AppstoreOutlined />, label: <Link href="/editor">三维编辑器</Link> }
			);
		}

		if (role === 'superadmin' || metaverseAllowed) {
			quickAccessItems.push(
				{ key: '/resources', icon: <FileOutlined />, label: <Link href="/resources">资源管理</Link> }
			);
		}

		if (quickAccessItems.length > 0) {
			list.push({
				key: 'quick-group',
				label: '快捷入口',
				type: 'group',
				children: quickAccessItems,
			});
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
					管理后台 · {role === 'superadmin' ? '超级管理员' : role === 'schoolAdmin' ? '校级管理员' : '教师'}
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
					padding: '8px 0',
					overflowY: 'auto',
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
