import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  Dimensions,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
  StatusBar,
  SafeAreaView,
  ActivityIndicator,
  Animated,
  PanResponder,
  TextInput
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = 80;
const FAVORITE_ALBUM = 'PhotoSwipe-精选喜欢';

// 备用演示相片（在系统无权限或相册为空时保证界面能完整展示体验）
const DEMO_PHOTOS = [
  { id: 'demo-1', uri: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80', filename: '夏日白沙滩.jpg', creationTime: Date.now() - 86400000 },
  { id: 'demo-2', uri: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80', filename: '星空雪山峰.jpg', creationTime: Date.now() - 172800000 },
  { id: 'demo-3', uri: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80', filename: '清晨雾中林.jpg', creationTime: Date.now() - 259200000 },
  { id: 'demo-4', uri: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80', filename: '森林阳光.jpg', creationTime: Date.now() - 345600000 },
  { id: 'demo-5', uri: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80', filename: '峡谷山水.jpg', creationTime: Date.now() - 432000000 },
  { id: 'demo-6', uri: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=800&q=80', filename: '绿色田野.jpg', creationTime: Date.now() - 518400000 },
  { id: 'demo-7', uri: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80', filename: '极简办公桌.jpg', creationTime: Date.now() - 604800000 }
];

export default function App() {
  const [photos, setPhotos] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [history, setHistory] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('info'); // 'info' | 'success' | 'warn'

  // 原生 Animated.ValueXY 驱动，100% 杜绝 Reanimated 在 Android 上的手势失效
  const position = useRef(new Animated.ValueXY()).current;
  const isSwiping = useRef(false);
  const toastTimeoutRef = useRef(null);

  // 顶卡引用与索引引用（供 PanResponder 回调闭包准确获取最新状态）
  const currentIndexRef = useRef(0);
  const photosRef = useRef([]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  // 显示顶部轻量通知
  const showToast = (msg, type = 'info') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    setToastType(type);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage('');
    }, 2800);
  };

  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    setLoading(true);
    try {
      // 申请相册读写权限
      const perm = await MediaLibrary.requestPermissionsAsync(false);
      const isGranted = perm.status === 'granted';

      if (isGranted) {
        await loadPhotos();
        await loadAlbums();
      } else {
        setPhotos(DEMO_PHOTOS);
        showToast('⚠️ 未获得相册权限，当前为演示相片', 'warn');
      }
    } catch (e) {
      console.log('权限初始化失败:', e);
      setPhotos(DEMO_PHOTOS);
    } finally {
      setLoading(false);
    }
  };

  // 全面加载系统相册照片
  const loadPhotos = async () => {
    try {
      setLoading(true);
      let photoList = [];

      // 1. 常规拉取最多 500 张照片
      try {
        const assets = await MediaLibrary.getAssetsAsync({
          first: 500,
          mediaType: ['photo']
        });
        if (assets && assets.assets && assets.assets.length > 0) {
          photoList = assets.assets;
        }
      } catch (err) {
        console.log('一级相册拉取失败，尝试降级:', err);
      }

      // 2. 遍历各子相册（Camera, DCIM, Pictures）兜底
      if (photoList.length === 0) {
        try {
          const userAlbums = await MediaLibrary.getAlbumsAsync();
          for (const alb of userAlbums) {
            if (alb.assetCount > 0) {
              const albAssets = await MediaLibrary.getAssetsAsync({
                album: alb,
                first: 100,
                mediaType: ['photo']
              });
              if (albAssets && albAssets.assets && albAssets.assets.length > 0) {
                photoList = [...photoList, ...albAssets.assets];
              }
            }
          }
        } catch (err) {
          console.log('遍历相册拉取失败:', err);
        }
      }

      // 3. 兜底保护：若手机无照片或仅 1 张，补充演示照片确保能体验连续滑动
      if (photoList.length === 0) {
        photoList = DEMO_PHOTOS;
        showToast('相册为空，已加载精选演示照片', 'info');
      }

      setPhotos(photoList);
      setCurrentIndex(0);
      showToast(`已加载 ${photoList.length} 张照片 🍃`, 'success');
    } catch (e) {
      console.log('读取照片异常:', e);
      setPhotos(DEMO_PHOTOS);
    } finally {
      setLoading(false);
    }
  };

  // 加载手机相册列表
  const loadAlbums = async () => {
    try {
      const userAlbums = await MediaLibrary.getAlbumsAsync();
      setAlbums(userAlbums || []);
    } catch (e) {
      console.log('读取相册列表失败:', e);
    }
  };

  // 触觉反馈
  const triggerHaptic = (type) => {
    try {
      if (type === 'delete') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e) {}
  };

  // 核心：真实系统相册联动逻辑
  const executeSystemMediaAction = async (action, photo, targetAlbum = null) => {
    if (!photo || (photo.id && String(photo.id).startsWith('demo-'))) {
      if (action === 'delete') showToast('🗑 [演示] 已删除当前照片', 'warn');
      if (action === 'like') showToast('❤️ [演示] 已收藏至精选相册', 'success');
      if (action === 'keep') showToast('✨ [演示] 已保留在相册', 'info');
      if (action === 'album') showToast(`📁 [演示] 已归档至「${targetAlbum?.title || targetAlbum}」`, 'success');
      return;
    }

    try {
      // 1. 真删除：调用 MediaLibrary.deleteAssetsAsync
      if (action === 'delete') {
        try {
          const success = await MediaLibrary.deleteAssetsAsync([photo.id || photo]);
          if (success) {
            showToast('🗑 已真正从系统相册删除', 'warn');
          } else {
            showToast('⚠️ 未确认删除或权限限制', 'info');
          }
        } catch (delErr) {
          console.log('删除异常或用户取消:', delErr);
          showToast('⚠️ 删除已取消或未完成', 'info');
        }
      }

      // 2. 真收藏：联动系统专属相册「PhotoSwipe-精选喜欢」
      else if (action === 'like') {
        try {
          let favAlbum = await MediaLibrary.getAlbumAsync(FAVORITE_ALBUM);
          if (!favAlbum) {
            favAlbum = await MediaLibrary.createAlbumAsync(FAVORITE_ALBUM, photo.id || photo, false);
            await loadAlbums();
          } else {
            await MediaLibrary.addAssetsToAlbumAsync([photo.id || photo], favAlbum, false);
          }
          showToast(`❤️ 已真正收录进系统相册【${FAVORITE_ALBUM}】`, 'success');
        } catch (likeErr) {
          console.log('添加收藏相册重试复制模式:', likeErr);
          try {
            let favAlbum = await MediaLibrary.getAlbumAsync(FAVORITE_ALBUM);
            if (favAlbum) {
              await MediaLibrary.addAssetsToAlbumAsync([photo.id || photo], favAlbum, true);
              showToast(`❤️ 已收录进系统相册【${FAVORITE_ALBUM}】`, 'success');
            }
          } catch (e2) {
            showToast('⚠️ 收藏进相册失败，请检查写入权限', 'warn');
          }
        }
      }

      // 3. 真归档：存入用户指定系统相册
      else if (action === 'album' && targetAlbum) {
        try {
          let albumObj = targetAlbum;
          if (typeof targetAlbum === 'string') {
            albumObj = await MediaLibrary.getAlbumAsync(targetAlbum);
            if (!albumObj) {
              albumObj = await MediaLibrary.createAlbumAsync(targetAlbum, photo.id || photo, false);
            }
          }
          await MediaLibrary.addAssetsToAlbumAsync([photo.id || photo], albumObj, false);
          await loadAlbums();
          const albName = albumObj?.title || targetAlbum;
          showToast(`📁 已真正移入系统相册【${albName}】`, 'success');
        } catch (albErr) {
          console.log('收纳相册重试复制模式:', albErr);
          try {
            let albumObj = targetAlbum;
            if (typeof targetAlbum === 'string') {
              albumObj = await MediaLibrary.getAlbumAsync(targetAlbum);
            }
            if (albumObj) {
              await MediaLibrary.addAssetsToAlbumAsync([photo.id || photo], albumObj, true);
              const albName = albumObj?.title || targetAlbum;
              showToast(`📁 已收纳进系统相册【${albName}】`, 'success');
            }
          } catch (e3) {
            showToast('⚠️ 归档失败，请检查相册权限', 'warn');
          }
        }
      }

      // 4. 真保留：留在手机原相册不动
      else if (action === 'keep') {
        showToast('✨ 已保留在原相册', 'info');
      }
    } catch (e) {
      console.log('执行相册操作异常:', e);
    }
  };

  // 处理手势划出或按钮触发动作
  const handleAction = (action, targetAlbum = null) => {
    const idx = currentIndexRef.current;
    const currentPhoto = photosRef.current[idx];
    if (!currentPhoto) return;

    triggerHaptic(action);

    // 记录历史供反悔/撤销
    setHistory(prev => [...prev, { photo: currentPhoto, action, album: targetAlbum, index: idx }]);

    // 执行真实系统相册操作
    executeSystemMediaAction(action, currentPhoto, targetAlbum);

    // 推进到下一张
    setCurrentIndex(prev => prev + 1);
  };

  // 划出动画（按钮点击或手势飞出）
  const swipeCard = (targetX, targetY, action, targetAlbum = null) => {
    if (isSwiping.current) return;
    isSwiping.current = true;

    Animated.timing(position, {
      toValue: { x: targetX, y: targetY },
      duration: 200,
      useNativeDriver: false
    }).start(() => {
      handleAction(action, targetAlbum);
      position.setValue({ x: 0, y: 0 });
      isSwiping.current = false;
    });
  };

  // 弹簧回弹复位
  const resetPosition = () => {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      friction: 5,
      tension: 40,
      useNativeDriver: false
    }).start();
  };

  // 撤销上一步
  const handleUndo = () => {
    if (history.length === 0 || currentIndex === 0) {
      Alert.alert('提示', '当前没有可撤销的操作哦 🐱');
      return;
    }
    const lastOp = history[history.length - 1];
    if (lastOp.action === 'delete') {
      Alert.alert('提示', '该照片已从手机相册真正删除，无法在本地恢复 🐱');
    }
    setHistory(prev => prev.slice(0, -1));
    setCurrentIndex(prev => prev - 1);
    position.setValue({ x: 0, y: 0 });
    showToast('已撤销上一步', 'info');
  };

  // 创建新相册并收纳
  const handleCreateAndArchive = async () => {
    const trimmed = newAlbumName.trim();
    if (!trimmed) {
      Alert.alert('提示', '请输入新相册名称');
      return;
    }
    setModalVisible(false);
    setNewAlbumName('');
    swipeCard(0, SCREEN_HEIGHT, 'album', trimmed);
  };

  // 原生 PanResponder 手势监听器（100% 独占强力响应每一次触摸与拖拽）
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2;
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        position.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (e, gestureState) => {
        if (isSwiping.current) return;
        position.setValue({ x: gestureState.dx, y: gestureState.dy });
      },
      onPanResponderRelease: (_, gestureState) => {
        if (isSwiping.current) return;
        const { dx, dy } = gestureState;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);

        if (absY > absX && absY > SWIPE_THRESHOLD) {
          if (dy < -SWIPE_THRESHOLD) {
            // ⬆ 上滑：喜欢
            swipeCard(0, -SCREEN_HEIGHT * 1.2, 'like');
          } else {
            // ⬇ 下滑：收纳相册弹窗
            resetPosition();
            setPendingPhoto(photosRef.current[currentIndexRef.current]);
            setModalVisible(true);
          }
        } else if (absX > SWIPE_THRESHOLD) {
          if (dx < -SWIPE_THRESHOLD) {
            // ⬅ 左滑：删除
            swipeCard(-SCREEN_WIDTH * 1.5, 0, 'delete');
          } else {
            // ➡ 右滑：保留
            swipeCard(SCREEN_WIDTH * 1.5, 0, 'keep');
          }
        } else {
          // 未过阈值复位
          resetPosition();
        }
      },
      onPanResponderTerminate: () => {
        resetPosition();
      }
    })
  ).current;

  // 顶层活动卡片旋转动画
  const rotate = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH * 1.5, 0, SCREEN_WIDTH * 1.5],
    outputRange: ['-24deg', '0deg', '24deg'],
    extrapolate: 'clamp'
  });

  const topCardStyle = {
    transform: [
      ...position.getTranslateTransform(),
      { rotate }
    ]
  };

  // 底层备用卡片跟随平滑放大（Tinder 双层 Deck）
  const bottomCardScale = position.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD * 2, 0, SWIPE_THRESHOLD * 2],
    outputRange: [1, 0.94, 1],
    extrapolate: 'clamp'
  });
  const bottomCardOpacity = position.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD * 2, 0, SWIPE_THRESHOLD * 2],
    outputRange: [1, 0.85, 1],
    extrapolate: 'clamp'
  });

  // 四向印章透明度渐变
  const likeBadgeOpacity = position.y.interpolate({
    inputRange: [-100, -25, 0],
    outputRange: [1, 0.5, 0],
    extrapolate: 'clamp'
  });
  const albumBadgeOpacity = position.y.interpolate({
    inputRange: [0, 25, 100],
    outputRange: [0, 0.5, 1],
    extrapolate: 'clamp'
  });
  const deleteBadgeOpacity = position.x.interpolate({
    inputRange: [-100, -25, 0],
    outputRange: [1, 0.5, 0],
    extrapolate: 'clamp'
  });
  const keepBadgeOpacity = position.x.interpolate({
    inputRange: [0, 25, 100],
    outputRange: [0, 0.5, 1],
    extrapolate: 'clamp'
  });

  const currentPhoto = photos[currentIndex];
  const nextPhoto = currentIndex + 1 < photos.length ? photos[currentIndex + 1] : null;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F8F6" />

      {/* 顶部状态栏与清新计数 */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>🍃</Text>
          </View>
          <View>
            <Text style={styles.title}>PhotoSwipe</Text>
            <Text style={styles.subTitle}>系统相册实时联动版</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.refreshBtn} onPress={loadPhotos} activeOpacity={0.7}>
            <Text style={styles.refreshBtnText}>🔄 重新扫描</Text>
          </TouchableOpacity>
          <View style={styles.counterPill}>
            <Text style={styles.counterText}>
              {photos.length > 0 ? `${currentIndex + 1} / ${photos.length}` : '0 / 0'}
            </Text>
          </View>
        </View>
      </View>

      {/* 浮动实时操作通知 Toast */}
      {toastMessage !== '' && (
        <View style={[
          styles.toastContainer,
          toastType === 'warn' ? styles.toastWarn : toastType === 'success' ? styles.toastSuccess : styles.toastInfo
        ]}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* 卡片主操作区 (双层卡片堆叠 Dual Deck) */}
      <View style={styles.deck}>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={styles.loadingText}>正在扫描系统相册...</Text>
          </View>
        ) : currentIndex < photos.length && currentPhoto ? (
          <View style={styles.stackWrapper}>
            {/* 底层卡片：下一张照片预先常驻在下方，顶卡划走时平滑顶上 */}
            {nextPhoto && (
              <Animated.View
                style={[
                  styles.card,
                  styles.bottomCard,
                  {
                    transform: [{ scale: bottomCardScale }],
                    opacity: bottomCardOpacity
                  }
                ]}
              >
                <Image source={{ uri: nextPhoto.uri }} style={styles.photo} resizeMode="cover" />
                <View style={styles.photoInfo}>
                  <Text style={styles.photoName} numberOfLines={1}>{nextPhoto.filename || '下一张照片'}</Text>
                  <Text style={styles.photoDate}>
                    {nextPhoto.creationTime ? new Date(nextPhoto.creationTime).toLocaleDateString() : '相册照片'}
                  </Text>
                </View>
              </Animated.View>
            )}

            {/* 顶层活动卡片：绑定原生 PanResponder 手势 */}
            <Animated.View
              style={[styles.card, topCardStyle]}
              {...panResponder.panHandlers}
            >
              <Image
                source={{ uri: currentPhoto.uri }}
                style={styles.photo}
                resizeMode="cover"
                pointerEvents="none"
              />

              {/* 四向实时提示印章 */}
              <Animated.View pointerEvents="none" style={[styles.badge, styles.likeBadge, { opacity: likeBadgeOpacity }]}>
                <Text style={styles.likeBadgeText}>❤️ 喜欢 (进精选相册)</Text>
              </Animated.View>
              <Animated.View pointerEvents="none" style={[styles.badge, styles.albumBadge, { opacity: albumBadgeOpacity }]}>
                <Text style={styles.albumBadgeText}>📁 归入指定相册</Text>
              </Animated.View>
              <Animated.View pointerEvents="none" style={[styles.badge, styles.deleteBadge, { opacity: deleteBadgeOpacity }]}>
                <Text style={styles.deleteBadgeText}>🗑 删除 (移出相册)</Text>
              </Animated.View>
              <Animated.View pointerEvents="none" style={[styles.badge, styles.keepBadge, { opacity: keepBadgeOpacity }]}>
                <Text style={styles.keepBadgeText}>✨ 保留原样</Text>
              </Animated.View>

              {/* 底部照片信息 */}
              <View pointerEvents="none" style={styles.photoInfo}>
                <Text style={styles.photoName} numberOfLines={1}>{currentPhoto.filename || '相册照片'}</Text>
                <Text style={styles.photoDate}>
                  {currentPhoto.creationTime ? new Date(currentPhoto.creationTime).toLocaleDateString() : '最近拍摄'}
                </Text>
              </View>
            </Animated.View>
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Text style={{ fontSize: 44 }}>✨</Text>
            </View>
            <Text style={styles.emptyTitle}>全部整理完毕！</Text>
            <Text style={styles.emptySubtitle}>您已完成了相册所有照片的整理 🐱</Text>
            <TouchableOpacity style={styles.restartBtn} onPress={() => setCurrentIndex(0)} activeOpacity={0.75}>
              <Text style={styles.restartBtnText}>🔄 从头再次整理</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 底部操作胶囊栏 */}
      <View style={styles.controls}>
        <TouchableOpacity style={[styles.btn, styles.undoBtn]} onPress={handleUndo} activeOpacity={0.75}>
          <Text style={styles.undoBtnIcon}>↩</Text>
          <Text style={styles.undoBtnText}>反悔</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.deleteBtn]}
          onPress={() => swipeCard(-SCREEN_WIDTH * 1.5, 0, 'delete')}
          activeOpacity={0.75}
        >
          <Text style={styles.deleteBtnIcon}>🗑</Text>
          <Text style={styles.deleteBtnText}>左滑删</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.albumBtn]}
          onPress={() => {
            setPendingPhoto(photos[currentIndex]);
            setModalVisible(true);
          }}
          activeOpacity={0.75}
        >
          <Text style={styles.albumBtnIcon}>📁</Text>
          <Text style={styles.albumBtnText}>下滑存</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.likeBtn]}
          onPress={() => swipeCard(0, -SCREEN_HEIGHT * 1.2, 'like')}
          activeOpacity={0.75}
        >
          <Text style={styles.likeBtnIcon}>❤️</Text>
          <Text style={styles.likeBtnText}>上滑爱</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.keepBtn]}
          onPress={() => swipeCard(SCREEN_WIDTH * 1.5, 0, 'keep')}
          activeOpacity={0.75}
        >
          <Text style={styles.keepBtnIcon}>✨</Text>
          <Text style={styles.keepBtnText}>右滑留</Text>
        </TouchableOpacity>
      </View>

      {/* 相册归档抽屉弹窗 */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIndicator} />
              <Text style={styles.modalTitle}>选择或新建归档相册</Text>
              <Text style={styles.modalDesc}>将当前照片真正归纳进系统图库相册</Text>
            </View>

            {/* 快捷新建相册输入栏 */}
            <View style={styles.createAlbumRow}>
              <TextInput
                style={styles.newAlbumInput}
                placeholder="新建相册名称 (如: 旅行、美食)..."
                placeholderTextColor="#94A3B8"
                value={newAlbumName}
                onChangeText={setNewAlbumName}
              />
              <TouchableOpacity
                style={styles.createAlbumBtn}
                onPress={handleCreateAndArchive}
                activeOpacity={0.8}
              >
                <Text style={styles.createAlbumBtnText}>➕ 创建并存入</Text>
              </TouchableOpacity>
            </View>

            {/* 既有相册列表 */}
            <FlatList
              data={albums}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.albumItem}
                  activeOpacity={0.7}
                  onPress={() => {
                    setModalVisible(false);
                    swipeCard(0, SCREEN_HEIGHT, 'album', item);
                  }}
                >
                  <View style={styles.albumItemLeft}>
                    <View style={styles.albumIconBox}>
                      <Text style={{ fontSize: 18 }}>🗂</Text>
                    </View>
                    <Text style={styles.albumTitle}>{item.title}</Text>
                  </View>
                  <Text style={styles.albumCount}>{item.assetCount || 0} 张</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={{ paddingVertical: 18, alignItems: 'center' }}>
                  <Text style={{ color: '#94A3B8', fontSize: 13 }}>暂无自定义相册，可直接在上方创建新相册</Text>
                </View>
              }
            />

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelText}>取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F8F6'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 6,
    alignItems: 'center'
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#E6F4EA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10
  },
  logoBadgeText: {
    fontSize: 18
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#134E4A'
  },
  subTitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  refreshBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14
  },
  refreshBtnText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600'
  },
  counterPill: {
    backgroundColor: '#E6F4EA',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16
  },
  counterText: {
    fontSize: 12,
    color: '#047857',
    fontWeight: '700'
  },
  toastContainer: {
    marginHorizontal: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 4
  },
  toastInfo: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0'
  },
  toastSuccess: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#6EE7B7'
  },
  toastWarn: {
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3'
  },
  toastText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46'
  },
  deck: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginVertical: 4
  },
  loadingBox: {
    alignItems: 'center',
    gap: 12
  },
  loadingText: {
    color: '#64748B',
    fontSize: 13
  },
  stackWrapper: {
    width: SCREEN_WIDTH - 32,
    height: SCREEN_HEIGHT * 0.65,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center'
  },
  card: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  bottomCard: {
    zIndex: 1
  },
  photo: {
    flex: 1,
    width: '100%',
    backgroundColor: '#EDF2F0'
  },
  badge: {
    position: 'absolute',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 2,
    zIndex: 99
  },
  likeBadge: {
    top: 24,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 241, 242, 0.95)',
    borderColor: '#FB7185'
  },
  likeBadgeText: {
    color: '#E11D48',
    fontWeight: '800',
    fontSize: 16
  },
  albumBadge: {
    bottom: 90,
    alignSelf: 'center',
    backgroundColor: 'rgba(236, 253, 245, 0.95)',
    borderColor: '#34D399'
  },
  albumBadgeText: {
    color: '#059669',
    fontWeight: '800',
    fontSize: 16
  },
  deleteBadge: {
    top: 24,
    right: 20,
    backgroundColor: 'rgba(255, 241, 242, 0.95)',
    borderColor: '#F87171'
  },
  deleteBadgeText: {
    color: '#DC2626',
    fontWeight: '800',
    fontSize: 16
  },
  keepBadge: {
    top: 24,
    left: 20,
    backgroundColor: 'rgba(240, 249, 255, 0.95)',
    borderColor: '#38BDF8'
  },
  keepBadgeText: {
    color: '#0284C7',
    fontWeight: '800',
    fontSize: 16
  },
  photoInfo: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  photoName: {
    color: '#1E293B',
    fontSize: 15,
    fontWeight: '700'
  },
  photoDate: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30
  },
  emptyIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#E6F4EA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14
  },
  emptyTitle: {
    color: '#134E4A',
    fontSize: 20,
    fontWeight: '700'
  },
  emptySubtitle: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center'
  },
  restartBtn: {
    marginTop: 18,
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20
  },
  restartBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 18
  },
  btn: {
    flex: 1,
    marginHorizontal: 3,
    paddingVertical: 9,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  undoBtn: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  undoBtnIcon: { fontSize: 16, color: '#64748B' },
  undoBtnText: { fontSize: 11, fontWeight: '700', color: '#64748B', marginTop: 2 },

  deleteBtn: {
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3'
  },
  deleteBtnIcon: { fontSize: 16 },
  deleteBtnText: { fontSize: 11, fontWeight: '700', color: '#E11D48', marginTop: 2 },

  albumBtn: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0'
  },
  albumBtnIcon: { fontSize: 16 },
  albumBtnText: { fontSize: 11, fontWeight: '700', color: '#059669', marginTop: 2 },

  likeBtn: {
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FBCFE8'
  },
  likeBtnIcon: { fontSize: 16 },
  likeBtnText: { fontSize: 11, fontWeight: '700', color: '#DB2777', marginTop: 2 },

  keepBtn: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD'
  },
  keepBtnIcon: { fontSize: 16 },
  keepBtnText: { fontSize: 11, fontWeight: '700', color: '#0284C7', marginTop: 2 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    maxHeight: '70%'
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 14
  },
  modalIndicator: {
    width: 36,
    height: 4,
    backgroundColor: '#CBD5E1',
    borderRadius: 2,
    marginBottom: 12
  },
  modalTitle: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '700'
  },
  modalDesc: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2
  },
  createAlbumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14
  },
  newAlbumInput: {
    flex: 1,
    height: 42,
    backgroundColor: '#F8FAF9',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    fontSize: 13,
    color: '#1E293B'
  },
  createAlbumBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 14,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  createAlbumBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13
  },
  albumItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#F8FAF9',
    marginBottom: 8
  },
  albumItemLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  albumIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#E6F4EA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10
  },
  albumTitle: {
    color: '#1E293B',
    fontSize: 14,
    fontWeight: '600'
  },
  albumCount: {
    color: '#64748B',
    fontSize: 12
  },
  cancelBtn: {
    marginTop: 10,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 16
  },
  cancelText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 14
  }
});
